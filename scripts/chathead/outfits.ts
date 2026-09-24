import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Wearables } from "../../lib/chathead/wearables.ts";
import { encodePng } from "../game-icons/png.ts";
import type { WearPos } from "./server-obj.ts";

/**
 * What the outfit editor needs beyond the chathead itself, written by
 * `build.ts`:
 *
 *   public/img/game/worn/tab.png         the Worn Equipment tab, empty
 *   public/img/game/worn/slot-<n>.png    each slot's silhouette, for when it is empty
 *   lib/chathead/wearables.json          every wearable object by slot, the
 *                                        colour swatches, and their version
 *
 * The tab is drawn the way the client draws it: the side panel's stone
 * (`invback`), then the interface's own boxes and connecting lines, at the
 * positions `content/scripts/player/interfaces/wornitems.if` gives them. The
 * editor puts item icons and silhouettes over it at the slot positions in
 * `lib/chathead/wearables.ts`.
 */

type Jag = { read(name: string): Uint8Array | null };
type Sprite = { plotSprite(x: number, y: number): void };
type Pix32Sprite = Sprite & {
  data: Int32Array;
  wi: number;
  hi: number;
  xof: number;
  yof: number;
  owi: number;
  ohi: number;
};

export type SpriteClient = {
  Pix2D: { setPixels(pixels: Int32Array, width: number, height: number): void };
  Pix8: { depack(jag: Jag, name: string, sprite: number): Sprite };
  Pix32: { depack(jag: Jag, name: string, sprite: number): Pix32Sprite };
  colourTable: Int32Array;
};

/**
 * The side panel the tabs are drawn on is 190x261; the slots end at 198, and
 * what the game puts under them (the equipment bonuses) is not part of an
 * outfit, so the picture stops just below the last row.
 */
const TAB = { width: 190, height: 202 };

/**
 * `wornitems.if` com_0 to com_22: the connecting lines (`miscgraphics` 2 and
 * 3) under the slot boxes (`miscgraphics` 0), in the file's order, which is
 * the order the client draws them in.
 */
const TAB_GRAPHICS: readonly (readonly [x: number, y: number, sprite: number])[] =
  [
    [78, 39, 2], [78, 68, 2], [78, 105, 2], [78, 146, 2],
    [22, 118, 2], [22, 154, 2], [134, 118, 2], [134, 154, 2],
    [48, 81, 3], [107, 81, 3], [58, 42, 3], [112, 41, 3],
    [78, 4, 0], [37, 43, 0], [78, 43, 0], [119, 43, 0],
    [22, 82, 0], [78, 82, 0], [134, 82, 0], [78, 122, 0],
    [78, 162, 0], [22, 162, 0], [134, 162, 0],
  ];

/**
 * `wornitems.if`'s inventory: wearpos -> the `wornicons` silhouette its
 * empty slot shows. Arms (6), hair (8) and jaw (11) are body parts, not
 * places to put things, and have none.
 */
const SILHOUETTES: ReadonlyMap<number, number> = new Map([
  [0, 0], [1, 1], [2, 2], [3, 3], [4, 5], [5, 6],
  [7, 7], [9, 8], [10, 9], [12, 4], [13, 10],
]);

/** A sprite at its full cell size, trimmed margins restored as transparency. */
function uncrop(sprite: Pix32Sprite): Int32Array {
  const out = new Int32Array(sprite.owi * sprite.ohi);
  for (let y = 0; y < sprite.hi; y++) {
    for (let x = 0; x < sprite.wi; x++) {
      out[x + sprite.xof + (y + sprite.yof) * sprite.owi] =
        sprite.data[x + y * sprite.wi];
    }
  }
  return out;
}

export function exportOutfitEditor(options: {
  client: SpriteClient;
  media: Jag;
  wearpos: readonly WearPos[];
  recol1d: readonly (readonly number[])[];
  outDir: string;
}): Wearables {
  const { client, media, wearpos, recol1d, outDir } = options;
  const dir = path.join(outDir, "public/img/game/worn");
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const hash = createHash("sha256");
  function write(name: string, pixels: Int32Array, w: number, h: number) {
    const png = encodePng(pixels, w, h);
    writeFileSync(path.join(dir, name), png);
    hash.update(name);
    hash.update(png);
  }

  // The empty tab. Every pixel is covered by the stone, so the PNG is opaque.
  const tab = new Int32Array(TAB.width * TAB.height);
  client.Pix2D.setPixels(tab, TAB.width, TAB.height);
  client.Pix8.depack(media, "invback", 0).plotSprite(0, 0);
  for (const [x, y, sprite] of TAB_GRAPHICS) {
    client.Pix32.depack(media, "miscgraphics", sprite).plotSprite(x, y);
  }
  write("tab.png", tab, TAB.width, TAB.height);

  for (const [slot, sprite] of SILHOUETTES) {
    const icon = client.Pix32.depack(media, "wornicons", sprite);
    write(`slot-${slot}.png`, uncrop(icon), icon.owi, icon.ohi);
  }

  const slots: Record<string, number[]> = {};
  wearpos.forEach(({ wearpos: slot, dummy }, id) => {
    if (slot < 0 || dummy) return;
    (slots[slot] ??= []).push(id);
  });

  // The swatches the design screen would show: each palette entry through
  // the client's own colour table, so they match the shading of the head.
  const palettes = recol1d.map((palette) =>
    palette.map((hsl) => client.colourTable[hsl]),
  );

  const body = { slots, palettes };
  hash.update(JSON.stringify(body));
  const wearables: Wearables = {
    version: hash.digest("hex").slice(0, 8),
    ...body,
  };
  writeFileSync(
    path.join(outDir, "lib/chathead/wearables.json"),
    JSON.stringify(wearables) + "\n",
  );
  return wearables;
}
