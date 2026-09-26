import { type Clip, emoteClip, lineCount, moodClip } from "./animate.ts";
import { decodeAnims, loadAnims } from "./anims-file.ts";
import type { AnimTables } from "./anims.ts";
import { decodeBodies, loadBodies } from "./bodies-file.ts";
import { type BodyTables, renderFigure } from "./body.ts";
import { type Client, prepare } from "./client.ts";
import { BACKGROUND, type Frame, renderChathead, toRgba } from "./draw.ts";
import figureJson from "./figure.json";
import type { HeadTables } from "./head.ts";
import tablesJson from "./heads.json";
import { type Look, lookKey } from "./look.ts";
import { decodeModels, loadModels } from "./models.ts";
import type { Emote, Mood } from "./vocab.ts";

/**
 * The chathead and figure renderer, in the browser.
 *
 * `renderer.js` and the files it draws from sit outside the app's bundle and
 * are only fetched when a page first shows a chathead or a figure — once,
 * however many are on it. They carry the build's version, because
 * `next.config.ts` caches `/game/chathead` for a year: a regeneration changes
 * every URL.
 *
 * Chatheads and figures share the one renderer: a page with both loads
 * `models.bin` and `bodies.bin` into it, each when first needed, and
 * `anims.bin` too once one of them moves.
 */

export const tables = tablesJson as HeadTables;
/** The figure's frame and version; its tables load with `bodies.bin`. */
export const figure = figureJson as { version: string; frame: Frame };

const RENDERER_SRC = `/game/chathead/renderer.js?v=${tables.version}`;
const MODELS_SRC = `/game/chathead/models.bin?v=${tables.version}`;
const BODIES_SRC = `/game/chathead/bodies.bin?v=${figure.version}`;
/** `anims.json` arrives as a chunk of its own, and names the version. */
const ANIMS_SRC = (anims: AnimTables) => `/game/chathead/anims.bin?v=${anims.version}`;

/**
 * A promise made once and kept, unless it fails: then the next call tries
 * again.
 */
function once<T>(start: () => Promise<T>): () => Promise<T> {
  let loading: Promise<T> | null = null;
  return () => {
    if (!loading) {
      loading = start();
      loading.catch(() => {
        loading = null;
      });
    }
    return loading;
  };
}

/** The renderer module, started up once. A failed load is retried next time. */
const loadRenderer = once(() =>
  (
    import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ RENDERER_SRC
    ) as Promise<Client>
  ).then((client) => {
    prepare(client);
    return client;
  }),
);

async function fetchBytes(src: string): Promise<Uint8Array> {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`${src}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

/** One drawing per look, drawn once and reused; null for nothing to draw. */
function drawnOnce(
  frame: Frame,
  render: (look: Look) => Int32Array | null,
): (look: Look) => ImageData | null {
  const drawn = new Map<string, ImageData | null>();
  return (look) => {
    const key = lookKey(look);
    let image = drawn.get(key);
    if (image === undefined) {
      const pixels = render(look);
      image = pixels ? new ImageData(toRgba(pixels), frame.width, frame.height) : null;
      drawn.set(key, image);
    }
    return image;
  };
}

// --- still pictures ---------------------------------------------------------

/** The renderer with the head models in it. */
const loadHeadModels = once(async () => {
  const [client, bytes] = await Promise.all([loadRenderer(), fetchBytes(MODELS_SRC)]);
  loadModels(client, decodeModels(bytes));
  return client;
});

/**
 * The renderer with the body models, textures and stances in it, and the
 * body tables. The tables are a few thousand numbers the page has no use for
 * until it draws, so they arrive as a chunk of their own, with the models.
 */
const loadBodyTables = once(async () => {
  const [client, bytes, bodyTables] = await Promise.all([
    loadRenderer(),
    fetchBytes(BODIES_SRC),
    import("./bodies.json").then((json) => json.default as unknown as BodyTables),
  ]);
  if (bodyTables.version !== figure.version) {
    throw new Error("figure: bodies.json and figure.json are from different builds");
  }
  loadBodies(client, decodeBodies(bytes));
  return { client, bodyTables };
});

/**
 * The renderer with the emotes' and moods' frames in it, and their tables:
 * a chunk of their own, which names the `anims.bin` to fetch. Its frames go
 * into the same table as the stances (`initAnimFrames`).
 */
const loadAnimTables = once(async () => {
  const [client, anims] = await Promise.all([
    loadRenderer(),
    import("./anims.json").then((json) => json.default as unknown as AnimTables),
  ]);
  loadAnims(client, decodeAnims(await fetchBytes(ANIMS_SRC(anims))));
  return anims;
});

export type Chatheads = {
  frame: HeadTables["frame"];
  /** One look's chathead, drawn once per look and reused; null if no head. */
  draw(look: Look): ImageData | null;
};

/** The renderer, loading it on first use. A failed load is retried next time. */
export const loadChatheads = once(async (): Promise<Chatheads> => {
  const client = await loadHeadModels();
  return {
    frame: tables.frame,
    draw: drawnOnce(tables.frame, (look) => renderChathead(client, tables, look)),
  };
});

export type Figures = {
  frame: Frame;
  /** One look's figure, drawn once per look and reused; null if no body. */
  draw(look: Look): ImageData | null;
};

/** The figure renderer, loading it on first use. A failed load is retried. */
export const loadFigures = once(async (): Promise<Figures> => {
  const { client, bodyTables } = await loadBodyTables();
  return {
    frame: figure.frame,
    draw: drawnOnce(figure.frame, (look) =>
      renderFigure(client, bodyTables, look, figure.frame),
    ),
  };
});

// --- moving pictures --------------------------------------------------------

/**
 * A clip ready for a canvas, played as `animate.ts`'s `Clip` says (`frameAt`).
 * Its frames are cut to the box every one of them draws in, which is put at
 * `x`, `y` in the frame: a head fills a quarter of its frame, and a mood
 * has up to eighty different frames. Frames the seq repeats are one image.
 */
export type ImageClip = {
  frames: ImageData[];
  delays: number[];
  loop: number | null;
  x: number;
  y: number;
};

function toImageClip(clip: Clip, frame: Frame): ImageClip {
  const distinct = [...new Set(clip.frames)];
  let left = frame.width;
  let top = frame.height;
  let right = -1;
  let bottom = -1;
  for (const pixels of distinct) {
    for (let y = 0; y < frame.height; y++) {
      for (let x = 0; x < frame.width; x++) {
        if (pixels[x + y * frame.width] === BACKGROUND) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  // Nothing drawn in any frame: one clear pixel.
  if (right < 0) left = top = right = bottom = 0;

  const width = right - left + 1;
  const height = bottom - top + 1;
  const images = new Map<Int32Array, ImageData>();
  for (const pixels of distinct) {
    const cut = new Int32Array(width * height);
    for (let y = 0; y < height; y++) {
      const from = left + (top + y) * frame.width;
      cut.set(pixels.subarray(from, from + width), y * width);
    }
    images.set(pixels, new ImageData(toRgba(cut), width, height));
  }
  return {
    frames: clip.frames.map((pixels) => images.get(pixels)!),
    delays: clip.delays,
    loop: clip.loop,
    x: left,
    y: top,
  };
}

/** One clip per key, drawn once and reused; null for nothing to draw. */
function clipsOnce<A extends unknown[]>(
  frame: Frame,
  key: (...args: A) => string,
  draw: (...args: A) => Clip | null,
): (...args: A) => ImageClip | null {
  const drawn = new Map<string, ImageClip | null>();
  return (...args) => {
    const k = key(...args);
    let clip = drawn.get(k);
    if (clip === undefined) {
      const pixels = draw(...args);
      clip = pixels ? toImageClip(pixels, frame) : null;
      drawn.set(k, clip);
    }
    return clip;
  };
}

export type FigureClips = {
  /** A look acting out an emote, drawn once per look and emote; null if no body. */
  emote(look: Look, emote: Emote): ImageClip | null;
};

/**
 * The figure renderer with the emotes, loading `renderer.js`, `bodies.bin`
 * and `anims.bin` on first use. A failed load is retried.
 */
export const loadFigureClips = once(async (): Promise<FigureClips> => {
  const [{ client, bodyTables }, anims] = await Promise.all([
    loadBodyTables(),
    loadAnimTables(),
  ]);
  return {
    emote: clipsOnce(
      figure.frame,
      (look: Look, emote: Emote) => `${lookKey(look)}/${emote}`,
      (look, emote) => emoteClip(client, bodyTables, anims, look, emote, figure.frame),
    ),
  };
});

export type ChatheadClips = {
  /**
   * A look's chathead talking in a mood for a page of `lines` lines, drawn
   * once per look, mood and line count; null if no head.
   */
  mood(look: Look, mood: Mood, lines: number): ImageClip | null;
};

/**
 * The chathead renderer with the moods, loading `renderer.js`, `models.bin`
 * and `anims.bin` on first use. A failed load is retried.
 */
export const loadChatheadClips = once(async (): Promise<ChatheadClips> => {
  const [client, anims] = await Promise.all([loadHeadModels(), loadAnimTables()]);
  return {
    mood: clipsOnce(
      tables.frame,
      (look: Look, mood: Mood, lines: number) => `${lookKey(look)}/${mood}/${lineCount(lines)}`,
      (look, mood, lines) => moodClip(client, tables, anims, look, mood, lines),
    ),
  };
});
