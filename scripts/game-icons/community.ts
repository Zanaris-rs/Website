import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { decodeBodies, loadBodies } from "../../lib/chathead/bodies-file.ts";
import bodiesJson from "../../lib/chathead/bodies.json";
import type { BodyTables } from "../../lib/chathead/body.ts";
import type { Client } from "../../lib/chathead/client.ts";
import { decodeBackdrop } from "../../lib/scenes/draw.ts";
import { drawPhoto, PHOTO_FALLBACK } from "../../lib/scenes/photo.ts";
import { sceneOf } from "../../lib/scenes/spots.ts";
import { BULKY, REFERENCE, WOMAN } from "../scenes/looks.ts";

/**
 * The Community tile on `/title`: Varrock square with three adventurers
 * standing in it, the way a clan photo stands them.
 *
 * It is drawn with exactly what a page draws a clan photo with: the
 * committed `public/game/chathead/renderer.js` (the client's own `Model`,
 * `Pix3D` and `Pix2D`) and `bodies.bin`, the committed backdrop, and
 * `lib/scenes/photo.ts`'s `drawPhoto`. `lib/scenes/photo-golden.test.ts`
 * already runs the same draw outside a browser. So this needs neither the
 * engine's pack nor the Client-TS clone, only this repository; `render.ts`
 * calls it so the tile lands in the same versioned set as the others.
 *
 * The three are the scene build's own reference looks (`scripts/scenes/
 * looks.ts`), left to right: the new player as a woman, the rune-armoured
 * one in the middle, the new player as a man. Nobody's real outfit.
 *
 * The photo is 240x300. At full size the three stand about 97 pixels wide,
 * more than a 77-pixel tile, so the tile is `CROP` - a 154x240 window that
 * holds the statue, the fountain and all three - averaged down two to one,
 * as `render.ts` averages its object tiles down from four times their size.
 */

/** The window of the photo the tile shows, and how many photo pixels make one tile pixel. */
export const CROP = { x: 43, y: 40, scale: 2 } as const;

/** Left to right in the photo. */
export const COMMUNITY_LOOKS = [WOMAN, BULKY, REFERENCE] as const;

/** The client's black: 0 is the PNG encoder's transparent, so black is 1. */
const BLACK = 1;

/** The 77x120 tile's pixels, `0xRRGGBB`, from the repository at `repo`. */
export async function drawCommunityTile(repo: string, width: number, height: number): Promise<Int32Array> {
  const game = path.join(repo, "public/game");
  const client = (await import(pathToFileURL(path.join(game, "chathead/renderer.js")).href)) as Client;
  loadBodies(client, decodeBodies(new Uint8Array(readFileSync(path.join(game, "chathead/bodies.bin")))));

  const spot = sceneOf(PHOTO_FALLBACK);
  if (!spot) throw new Error(`${PHOTO_FALLBACK} is not in lib/scenes/spots.json: run npm run scenes:update`);
  const png = new Uint8Array(readFileSync(path.join(game, `scenes/${spot.key}.png`)));
  const backdrop = await decodeBackdrop(png, spot);
  const photo = drawPhoto(client, bodiesJson as unknown as BodyTables, spot, backdrop, [...COMMUNITY_LOOKS]);

  const { x: left, y: top, scale } = CROP;
  if (left + width * scale > spot.width || top + height * scale > spot.height) {
    throw new Error(`the community tile's crop runs off the ${spot.width}x${spot.height} photo`);
  }
  const block = scale * scale;
  const out = new Int32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let red = 0;
      let green = 0;
      let blue = 0;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const rgb = photo[left + x * scale + dx + (top + y * scale + dy) * spot.width];
          red += (rgb >> 16) & 0xff;
          green += (rgb >> 8) & 0xff;
          blue += rgb & 0xff;
        }
      }
      const rgb = (((red / block) | 0) << 16) | (((green / block) | 0) << 8) | ((blue / block) | 0);
      out[x + y * width] = rgb === 0 ? BLACK : rgb;
    }
  }
  return out;
}
