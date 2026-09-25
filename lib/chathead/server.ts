import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { encodePng } from "@/lib/png";

import { type Client, prepare } from "./client.ts";
import { BACKGROUND, renderChathead, toRgba } from "./draw.ts";
import type { HeadTables } from "./head.ts";
import tablesJson from "./heads.json";
import type { Look } from "./look.ts";
import { decodeModels, loadModels } from "./models.ts";

/**
 * A chathead drawn on the server, for pictures that leave the site: a log's
 * link preview (`app/adventurer-log/[username]/opengraph-image.tsx`) is drawn
 * before any browser is involved, so the head has to be drawn here.
 *
 * It is the page's renderer, not a copy: the same `renderer.js` (the client's
 * own code) and `models.bin` the browser fetches, read from `public/` and
 * drawn by this directory's head assembly — so the preview is pixel for pixel
 * the head on the log, and the golden test vouches for both. The files sit
 * outside the server bundle, which is why `next.config.ts` lists them in
 * `outputFileTracingIncludes`: a deployment has to ship them to the function.
 *
 * Loaded on the first drawing, not when the module is: the log page imports
 * the image module too (for its `og:image` size), and must not pay for this.
 * The renderer draws into module-level buffers, so it is loaded once per
 * server instance and shared. That is safe because a drawing is synchronous
 * from `setPixels` to the last triangle: two requests cannot interleave in it.
 */

const tables = tablesJson as HeadTables;

let renderer: Promise<Client> | null = null;

/** The renderer with the models loaded, once. A failed load is retried next time. */
function loadRenderer(): Promise<Client> {
  if (!renderer) {
    renderer = (async () => {
      // Each file by its whole path: a directory here would have the build
      // ship all of `public/game/chathead`, figures' `bodies.bin` included.
      const script = path.join(process.cwd(), "public/game/chathead/renderer.js");
      const models = path.join(process.cwd(), "public/game/chathead/models.bin");
      const client = (await import(
        /* webpackIgnore: true */ /* turbopackIgnore: true */ pathToFileURL(script).href
      )) as Client;
      prepare(client);
      loadModels(client, decodeModels(readFileSync(models)));
      return client;
    })();
    renderer.catch(() => {
      renderer = null;
    });
  }
  return renderer;
}

/**
 * A look's chathead as a PNG, `scale` times the frame's size (133x200) with
 * every pixel a solid `scale`-by-`scale` block — the game's pixels, not a
 * blur of them. What the renderer did not touch is transparent. A look with
 * no head to draw is null, as it is an empty frame on the page.
 */
export async function chatheadPng(look: Look, scale: number): Promise<Buffer | null> {
  if (!Number.isInteger(scale) || scale < 1) {
    throw new Error(`chathead: scale must be a whole number of pixels, not ${scale}`);
  }

  const pixels = renderChathead(await loadRenderer(), tables, look);
  if (!pixels || pixels.every((rgb) => rgb === BACKGROUND)) return null;

  const { width, height } = tables.frame;
  // One RGBA pixel is one u32 here; only copied, so byte order is moot.
  const src = new Uint32Array(toRgba(pixels).buffer);
  const out = new Uint32Array(width * scale * height * scale);
  const outWidth = width * scale;

  for (let y = 0; y < height; y++) {
    const top = y * scale * outWidth;
    for (let x = 0; x < width; x++) {
      out.fill(src[y * width + x], top + x * scale, top + (x + 1) * scale);
    }
    // The other rows of the block are copies of the first.
    for (let i = 1; i < scale; i++) out.copyWithin(top + i * outWidth, top, top + outWidth);
  }

  return encodePng(outWidth, height * scale, new Uint8Array(out.buffer));
}
