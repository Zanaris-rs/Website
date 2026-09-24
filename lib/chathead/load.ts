import { type Client, prepare } from "./client.ts";
import { renderChathead, toRgba } from "./draw.ts";
import type { HeadTables } from "./head.ts";
import tablesJson from "./heads.json";
import { type Look, lookKey } from "./look.ts";
import { decodeModels, loadModels } from "./models.ts";

/**
 * The chathead renderer, in the browser.
 *
 * `renderer.js` and `models.bin` sit outside the app's bundle and are only
 * fetched when a page first shows a chathead — once, however many heads are
 * on it. Both carry the build's version, because `next.config.ts` caches
 * `/game/chathead` for a year: a regeneration changes every URL.
 */

export const tables = tablesJson as HeadTables;

const RENDERER_SRC = `/game/chathead/renderer.js?v=${tables.version}`;
const MODELS_SRC = `/game/chathead/models.bin?v=${tables.version}`;

export type Chatheads = {
  frame: HeadTables["frame"];
  /** One look's chathead, drawn once per look and reused; null if no head. */
  draw(look: Look): ImageData | null;
};

let loading: Promise<Chatheads> | null = null;

async function load(): Promise<Chatheads> {
  const [client, bytes] = await Promise.all([
    import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ RENDERER_SRC
    ) as Promise<Client>,
    fetch(MODELS_SRC).then((response) => {
      if (!response.ok) {
        throw new Error(`${MODELS_SRC}: HTTP ${response.status}`);
      }
      return response.arrayBuffer();
    }),
  ]);
  prepare(client);
  loadModels(client, decodeModels(new Uint8Array(bytes)));

  const { width, height } = tables.frame;
  const drawn = new Map<string, ImageData | null>();
  return {
    frame: tables.frame,
    draw(look) {
      const key = lookKey(look);
      let image = drawn.get(key);
      if (image === undefined) {
        const pixels = renderChathead(client, tables, look);
        image = pixels ? new ImageData(toRgba(pixels), width, height) : null;
        drawn.set(key, image);
      }
      return image;
    },
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
