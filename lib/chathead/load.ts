import { decodeBodies, loadBodies } from "./bodies-file.ts";
import { type BodyTables, renderFigure } from "./body.ts";
import { type Client, prepare } from "./client.ts";
import { type Frame, renderChathead, toRgba } from "./draw.ts";
import figureJson from "./figure.json";
import type { HeadTables } from "./head.ts";
import tablesJson from "./heads.json";
import { type Look, lookKey } from "./look.ts";
import { decodeModels, loadModels } from "./models.ts";

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
 * `models.bin` and `bodies.bin` into it, each when first needed.
 */

export const tables = tablesJson as HeadTables;
/** The figure's frame and version; its tables load with `bodies.bin`. */
export const figure = figureJson as { version: string; frame: Frame };

const RENDERER_SRC = `/game/chathead/renderer.js?v=${tables.version}`;
const MODELS_SRC = `/game/chathead/models.bin?v=${tables.version}`;
const BODIES_SRC = `/game/chathead/bodies.bin?v=${figure.version}`;

let renderer: Promise<Client> | null = null;

/** The renderer module, started up once. A failed load is retried next time. */
function loadRenderer(): Promise<Client> {
  if (!renderer) {
    renderer = (
      import(
        /* webpackIgnore: true */ /* turbopackIgnore: true */ RENDERER_SRC
      ) as Promise<Client>
    ).then((client) => {
      prepare(client);
      return client;
    });
    renderer.catch(() => {
      renderer = null;
    });
  }
  return renderer;
}

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

export type Chatheads = {
  frame: HeadTables["frame"];
  /** One look's chathead, drawn once per look and reused; null if no head. */
  draw(look: Look): ImageData | null;
};

let loading: Promise<Chatheads> | null = null;

async function load(): Promise<Chatheads> {
  const [client, bytes] = await Promise.all([loadRenderer(), fetchBytes(MODELS_SRC)]);
  loadModels(client, decodeModels(bytes));
  return {
    frame: tables.frame,
    draw: drawnOnce(tables.frame, (look) => renderChathead(client, tables, look)),
  };
}

/** The renderer, loading it on first use. A failed load is retried next time. */
export function loadChatheads(): Promise<Chatheads> {
  if (!loading) {
    loading = load();
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

export type Figures = {
  frame: Frame;
  /** One look's figure, drawn once per look and reused; null if no body. */
  draw(look: Look): ImageData | null;
};

let loadingFigures: Promise<Figures> | null = null;

async function loadBodiesFile(): Promise<Figures> {
  // The tables are a few thousand numbers the page has no use for until it
  // draws, so they arrive as a chunk of their own, with the models.
  const [client, bytes, bodyTables] = await Promise.all([
    loadRenderer(),
    fetchBytes(BODIES_SRC),
    import("./bodies.json").then((json) => json.default as unknown as BodyTables),
  ]);
  if (bodyTables.version !== figure.version) {
    throw new Error("figure: bodies.json and figure.json are from different builds");
  }
  loadBodies(client, decodeBodies(bytes));
  return {
    frame: figure.frame,
    draw: drawnOnce(figure.frame, (look) =>
      renderFigure(client, bodyTables, look, figure.frame),
    ),
  };
}

/** The figure renderer, loading it on first use. A failed load is retried. */
export function loadFigures(): Promise<Figures> {
  if (!loadingFigures) {
    loadingFigures = loadBodiesFile();
    loadingFigures.catch(() => {
      loadingFigures = null;
    });
  }
  return loadingFigures;
}
