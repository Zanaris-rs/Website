import { decodeBackdrop, drawAtEye, drawAtSpot, sceneFrame } from "../scenes/draw.ts";
import { drawPhoto } from "../scenes/photo.ts";
import { type SceneSpot, sceneSrc } from "../scenes/spots.ts";
import { type Clip, emoteClip, emoteStill, lineCount, moodClip, moodStill } from "./animate.ts";
import { decodeAnims, loadAnims } from "./anims-file.ts";
import type { AnimTables } from "./anims.ts";
import { decodeBodies, loadBodies } from "./bodies-file.ts";
import { type BodyTables, FIGURE_CAMERA, plainCamera, renderFigure } from "./body.ts";
import { type Client, prepare } from "./client.ts";
import { BACKGROUND, type Camera, drawModel, type Frame, renderChathead, toRgba } from "./draw.ts";
import { nearestFacing } from "./facing.ts";
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
 * `anims.bin` too once one of them moves. A figure standing in a scene
 * draws with the same renderer, onto its spot's backdrop PNG
 * (`public/game/scenes`, `lib/scenes/draw.ts`), fetched when first shown.
 *
 * A figure can be turned (`facing`, `lib/chathead/facing.ts`): drawn at
 * another angle in the turn frame, or in its scene at an angle the spot
 * proved (`spot.turns`), standing or acting out an emote. Every drawing is
 * kept by look and angle, the most recently used few of each kind
 * (`recent`).
 *
 * A still (`loadEmoteStill`, `loadMoodStill`) is one frame of an emote or a
 * mood, for the pickers that show a dozen at once.
 *
 * A clan photo (`loadClanPhoto`) is a row of figures drawn into one copy of
 * a spot's backdrop, once, and kept by nobody.
 */

export const tables = tablesJson as HeadTables;
/**
 * The figure's frames and version; its tables load with `bodies.bin`. A
 * figure is drawn in `frame` at the one angle it has always had, or turned
 * in `turnFrame`, which is centred on the figure's axis and holds every
 * golden look standing at every angle (`exportTurns`,
 * scripts/chathead/bodies.ts). An emote with a long weapon - a staff, a
 * spear - can still reach its edge at some angles, as some reach the plain
 * frame's.
 */
export const figure = figureJson as { version: string; frame: Frame; turnFrame: Frame };

/**
 * A facing as a figure is drawn and kept by: 0-15, the way `plainYaw` reads
 * it (`nearestFacing`: 17 is 1, -1 is 15), so one angle is one drawing; no
 * facing stays none, the plain figure.
 */
function drawnFacing(facing: number | undefined): number | undefined {
  return facing === undefined ? undefined : nearestFacing(facing);
}

/** The frame a figure is drawn in: the plain one with no facing, else the turn frame. */
function figureFrame(facing: number | undefined): Frame {
  return facing === undefined ? figure.frame : figure.turnFrame;
}

/** The camera a figure is drawn from: the figure's own, turned to the facing when there is one. */
function figureCamera(facing: number | undefined): Camera {
  return facing === undefined ? FIGURE_CAMERA : plainCamera(facing);
}

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

/**
 * A few of the most recently used entries, the least recently used
 * forgotten past `limit`. Every drawing is kept this way: still chatheads
 * and figures (one per look, and per angle for a turned figure), emote and
 * mood clips (per look, emote or mood, line count and angle), and a scene's
 * per spot and angle as well - a page shows a handful at once, and the
 * character editor lets its owner try every one.
 */
function recent<V>(limit: number) {
  const entries = new Map<string, V>();
  return {
    get(key: string): V | undefined {
      const value = entries.get(key);
      if (value !== undefined) {
        entries.delete(key);
        entries.set(key, value);
      }
      return value;
    },
    set(key: string, value: V): void {
      entries.delete(key);
      entries.set(key, value);
      for (const oldest of entries.keys()) {
        if (entries.size <= limit) break;
        entries.delete(oldest);
      }
    },
    delete(key: string): void {
      entries.delete(key);
    },
  };
}

/**
 * How many still drawings are kept, chatheads and figures each. A timeline
 * page shows a chathead per poster; a turned figure is drawn once per angle.
 */
const STILLS_KEPT = 64;

/** One drawing per key, drawn once and reused while it is recent; null for nothing to draw. */
function drawnOnce<A extends unknown[]>(
  key: (...args: A) => string,
  frameOf: (...args: A) => Frame,
  render: (...args: A) => Int32Array | null,
): (...args: A) => ImageData | null {
  const drawn = recent<ImageData | null>(STILLS_KEPT);
  return (...args) => {
    const k = key(...args);
    let image = drawn.get(k);
    if (image === undefined) {
      const pixels = render(...args);
      const frame = frameOf(...args);
      image = pixels ? new ImageData(toRgba(pixels), frame.width, frame.height) : null;
      drawn.set(k, image);
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
  /** One look's chathead, drawn once per look and reused while recent; null if no head. */
  draw(look: Look): ImageData | null;
};

/** The renderer, loading it on first use. A failed load is retried next time. */
export const loadChatheads = once(async (): Promise<Chatheads> => {
  const client = await loadHeadModels();
  return {
    frame: tables.frame,
    draw: drawnOnce(
      (look: Look) => lookKey(look),
      () => tables.frame,
      (look: Look) => renderChathead(client, tables, look),
    ),
  };
});

export type Figures = {
  frame: Frame;
  turnFrame: Frame;
  /**
   * One look's figure, drawn once per look and angle and reused while
   * recent; null if no body. With no `facing` it is the plain figure in
   * `frame`; with one, turned to it in `turnFrame`.
   */
  draw(look: Look, facing?: number): ImageData | null;
};

/** The figure renderer, loading it on first use. A failed load is retried. */
export const loadFigures = once(async (): Promise<Figures> => {
  const { client, bodyTables } = await loadBodyTables();
  const draw = drawnOnce(
    (look: Look, facing: number | undefined) =>
      facing === undefined ? lookKey(look) : `${lookKey(look)}/${facing}`,
    (_look: Look, facing: number | undefined) => figureFrame(facing),
    (look: Look, facing: number | undefined) =>
      renderFigure(client, bodyTables, look, figureFrame(facing), figureCamera(facing).yan),
  );
  return {
    frame: figure.frame,
    turnFrame: figure.turnFrame,
    draw: (look, facing) => draw(look, drawnFacing(facing)),
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

/**
 * `behind` is what an untouched frame holds: nothing (`BACKGROUND`) for a
 * figure drawn alone, the backdrop for one drawn into a scene. A scene's
 * frames are cut the same way, to the box the figure changes; that box
 * holds backdrop pixels around the figure, so each cut frame is opaque and
 * is painted over the backdrop.
 */
function toImageClip(clip: Clip, frame: Frame, behind?: Int32Array): ImageClip {
  const untouched = (pixels: Int32Array, i: number) =>
    pixels[i] === (behind ? behind[i] : BACKGROUND);
  const distinct = [...new Set(clip.frames)];
  let left = frame.width;
  let top = frame.height;
  let right = -1;
  let bottom = -1;
  for (const pixels of distinct) {
    for (let y = 0; y < frame.height; y++) {
      for (let x = 0; x < frame.width; x++) {
        if (untouched(pixels, x + y * frame.width)) continue;
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

/**
 * How many emote clips, and how many mood clips, are kept (`recent`). A log
 * page plays one look's signature emote or up to five pages' emotes and
 * moods; the editor, where the owner can try every one, stays bounded.
 */
const CLIPS_KEPT = 24;

/** One clip per key, drawn once and reused while it is recent; null for nothing to draw. */
function clipsOnce<A extends unknown[]>(
  key: (...args: A) => string,
  frameOf: (...args: A) => Frame,
  draw: (...args: A) => Clip | null,
): (...args: A) => ImageClip | null {
  const drawn = recent<ImageClip | null>(CLIPS_KEPT);
  return (...args) => {
    const k = key(...args);
    let clip = drawn.get(k);
    if (clip === undefined) {
      const pixels = draw(...args);
      clip = pixels ? toImageClip(pixels, frameOf(...args)) : null;
      drawn.set(k, clip);
    }
    return clip;
  };
}

export type FigureClips = {
  /**
   * A look acting out an emote, drawn once per look, emote and angle; null
   * if no body. With no `facing` it is the plain figure's; with one it is
   * played turned to it, in the turn frame, as the game plays an emote at
   * the angle a player is turned to.
   */
  emote(look: Look, emote: Emote, facing?: number): ImageClip | null;
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
  const emote = clipsOnce(
    (look: Look, act: Emote, facing: number | undefined) =>
      facing === undefined ? `${lookKey(look)}/${act}` : `${lookKey(look)}/${act}/${facing}`,
    (_look: Look, _act: Emote, facing: number | undefined) => figureFrame(facing),
    (look: Look, act: Emote, facing: number | undefined) => {
      const frame = figureFrame(facing);
      const camera = figureCamera(facing);
      return emoteClip(client, bodyTables, anims, look, act, frame, (body) =>
        drawModel(client, body, frame, camera),
      );
    },
  );
  return {
    emote: (look, act, facing) => emote(look, act, drawnFacing(facing)),
  };
});

// --- a figure in a scene ----------------------------------------------------

/** A spot's backdrop: the pixels a figure is drawn onto, and the picture to paint. */
type Backdrop = { pixels: Int32Array; image: ImageData };

/** The last few spots' backdrops, 288 KB each twice over (pixels and picture). */
const backdrops = recent<Promise<Backdrop>>(3);

/** A spot's backdrop, fetched and decoded once while it is in use. A failed load is retried. */
function loadBackdrop(spot: SceneSpot): Promise<Backdrop> {
  let loading = backdrops.get(spot.key);
  if (!loading) {
    const started = fetchBytes(sceneSrc(spot))
      .then((png) => decodeBackdrop(png, spot))
      .then((pixels) => ({ pixels, image: new ImageData(toRgba(pixels), spot.width, spot.height) }));
    started.catch(() => {
      if (backdrops.get(spot.key) === started) backdrops.delete(spot.key);
    });
    backdrops.set(spot.key, started);
    loading = started;
  }
  return loading;
}

/**
 * The last few figures drawn into scenes: a look standing, and a look
 * acting out an emote, at a spot and an angle. A log page shows one look at
 * one spot: standing at each angle it is turned to (up to sixteen), and up
 * to five page emotes. Null is kept too, for a look with no body.
 */
const sceneDraws = recent<ImageClip | null>(32);

function sceneDraw(key: string, frame: Frame, backdrop: Int32Array, draw: () => Clip | null) {
  let clip = sceneDraws.get(key);
  if (clip === undefined) {
    const drawn = draw();
    clip = drawn ? toImageClip(drawn, frame, backdrop) : null;
    sceneDraws.set(key, clip);
  }
  return clip;
}

export type Scene = {
  /** The backdrop, to paint first; every figure frame is painted over it. */
  backdrop: ImageData;
  /**
   * A look standing in the scene, turned `facing` steps from the spot's own
   * angle (0 unless given), as a one-frame clip cut to the box the figure
   * changes; null if the look has no body. Only the facings the spot proved
   * (`spot.turns`) are drawn: any other draws as the nearest of them.
   */
  stand(look: Look, facing?: number): ImageClip | null;
};

/**
 * A spot's backdrop and the figure renderer, loading `renderer.js`,
 * `bodies.bin` and the spot's PNG on first use. A failed load is retried.
 */
export async function loadScene(spot: SceneSpot): Promise<Scene> {
  const [{ client, bodyTables }, backdrop] = await Promise.all([loadBodyTables(), loadBackdrop(spot)]);
  const frame = sceneFrame(spot);
  return {
    backdrop: backdrop.image,
    stand: (look, facing = 0) => {
      // Only a proved facing is drawn, and one angle is one drawing.
      const turned = nearestFacing(facing, spot.turns);
      return sceneDraw(`${spot.key}/${lookKey(look)}/${turned}`, frame, backdrop.pixels, () => {
        const pixels = drawAtSpot(client, bodyTables, look, spot, backdrop.pixels, undefined, turned);
        return pixels ? { frames: [pixels], delays: [1], loop: null } : null;
      });
    },
  };
}

export type SceneClips = {
  /** The backdrop, as `Scene` has it. */
  backdrop: ImageData;
  /**
   * A look acting out an emote in the scene, turned `facing` steps (0
   * unless given, the nearest proved as `Scene.stand`); null if the look
   * has no body.
   */
  emote(look: Look, emote: Emote, facing?: number): ImageClip | null;
};

/**
 * `loadScene` with the emotes, loading `anims.bin` as well on first use. A
 * failed load is retried.
 */
export async function loadSceneClips(spot: SceneSpot): Promise<SceneClips> {
  const [{ client, bodyTables }, anims, backdrop] = await Promise.all([
    loadBodyTables(),
    loadAnimTables(),
    loadBackdrop(spot),
  ]);
  const frame = sceneFrame(spot);
  return {
    backdrop: backdrop.image,
    emote: (look, emote, facing = 0) => {
      const turned = nearestFacing(facing, spot.turns);
      return sceneDraw(`${spot.key}/${lookKey(look)}/${turned}/${emote}`, frame, backdrop.pixels, () =>
        emoteClip(client, bodyTables, anims, look, emote, frame, (body) =>
          drawAtEye(client, body, spot, backdrop.pixels, turned),
        ),
      );
    },
  };
}

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
      (look: Look, mood: Mood, lines: number) => `${lookKey(look)}/${mood}/${lineCount(lines)}`,
      () => tables.frame,
      (look: Look, mood: Mood, lines: number) => moodClip(client, tables, anims, look, mood, lines),
    ),
  };
});

// --- stills: one frame each, for pickers --------------------------------------

/**
 * The last stills drawn: an emote's or a mood's single frame, for the Words
 * tab's rows and pickers - thirteen emote choices and fourteen moods per
 * look, and a page or two's worth of looks. Null is kept too, for a look
 * with nothing to draw.
 */
const stills = recent<ImageData | null>(STILLS_KEPT);

/**
 * A look acting out an emote, as one still (`emoteStill`: its middle
 * frame); no emote is the look standing. Without `facing` it is drawn in the
 * figure frame at the design screen's angle, as `<Figure>` is; with one, in
 * the turn frame, turned that way. Loads `renderer.js`, `bodies.bin` and
 * `anims.bin` on first use.
 */
export async function loadEmoteStill(look: Look, emote: Emote | null, facing?: number): Promise<ImageData | null> {
  const [{ client, bodyTables }, anims] = await Promise.all([loadBodyTables(), loadAnimTables()]);
  const turned = drawnFacing(facing);
  const key = `emote/${lookKey(look)}/${emote ?? "stand"}/${turned ?? "plain"}`;
  let image = stills.get(key);
  if (image === undefined) {
    const frame = figureFrame(turned);
    const camera = figureCamera(turned);
    const pixels = emoteStill(client, bodyTables, anims, look, emote, (body) =>
      drawModel(client, body, frame, camera),
    );
    image = pixels ? new ImageData(toRgba(pixels), frame.width, frame.height) : null;
    stills.set(key, image);
  }
  return image;
}

/**
 * A look's chathead in a mood, as one still (`moodStill`). Loads
 * `renderer.js`, `models.bin` and `anims.bin` on first use.
 */
export async function loadMoodStill(look: Look, mood: Mood): Promise<ImageData | null> {
  const [client, anims] = await Promise.all([loadHeadModels(), loadAnimTables()]);
  const key = `mood/${lookKey(look)}/${mood}`;
  let image = stills.get(key);
  if (image === undefined) {
    const pixels = moodStill(client, tables, anims, look, mood);
    image = pixels ? new ImageData(toRgba(pixels), tables.frame.width, tables.frame.height) : null;
    stills.set(key, image);
  }
  return image;
}

// --- a clan photo -----------------------------------------------------------

export type PhotoDrawer = {
  /** The spot's backdrop as it is: what shows before the members are drawn, or instead of them. */
  backdrop: ImageData;
  /** The members, left to right, drawn far to near into one copy of the backdrop (`drawPhoto`). */
  draw(looks: readonly Look[]): ImageData;
};

/**
 * A spot's backdrop and the figure renderer, for a clan photo: `renderer.js`,
 * `bodies.bin` and the spot's PNG, fetched on first use and shared with the
 * scenes. A failed load is retried. A photo is drawn once and painted once,
 * so nothing is kept.
 */
export async function loadClanPhoto(spot: SceneSpot): Promise<PhotoDrawer> {
  const [{ client, bodyTables }, backdrop] = await Promise.all([loadBodyTables(), loadBackdrop(spot)]);
  return {
    backdrop: backdrop.image,
    draw: (looks) =>
      new ImageData(toRgba(drawPhoto(client, bodyTables, spot, backdrop.pixels, looks)), spot.width, spot.height),
  };
}
