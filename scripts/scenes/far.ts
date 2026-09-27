/**
 * See further than the game does.
 *
 * `World` draws 25 tiles around the camera and `Model` drops anything 3,500
 * units deep, both hard-coded. That is right for the game's 512x334 window
 * looking down on the player, but a scene is shot near eye level, where the
 * edge of the world would stand across the frame like a wall. This bun
 * plugin rewrites Client-TS's `dash3d/World.ts` and `dash3d/Model.ts` as they
 * are imported so the distance is TILES and the far clip FAR: every table,
 * loop and bound the 25 is spelled into, and the depth test that goes with
 * it. The Client-TS checkout itself is never touched.
 *
 * Each place is its own literal pattern with the number of times the
 * throwaway spike found it (Client-TS revision 274, 7d6ca61). If a Client-TS
 * update moves or rewrites any of them the count differs and this throws,
 * naming the place: a half-patched `World` would index past its tables or
 * render only part of the extra distance, silently.
 *
 * The figure is not affected: the site draws it with the unpatched
 * `renderer.js`, and `render.ts` checks each figure stands nearer than the
 * unpatched far clip.
 */

import { readFileSync } from "node:fs";

import { bunPlugin } from "./bun.ts";

/** The draw distance in tiles, from the game's 25. */
export const TILES = 40;
/** The far clip in scene units, from the game's 3,500 (scaled with TILES). */
export const FAR = 5600;
/** The game's own far clip: what the site's `renderer.js` still has. */
export const GAME_FAR = 3500;

type Patch = {
  /** Where the spike found it, for the error. */
  at: string;
  find: RegExp;
  /** How many times the spike found it. */
  count: number;
  replace: string;
};

const SIDE = 2 * TILES;

const PATCHES: Record<"World.ts" | "Model.ts", Patch[]> = {
  "World.ts": [
    {
      at: "World.ts:116, visBacking: 51 = 2 * 25 + 1 tiles a side",
      find: /new TypedArray4d\(8, 32, 51, 51, false\)/g,
      count: 1,
      replace: `new TypedArray4d(8, 32, ${SIDE + 1}, ${SIDE + 1}, false)`,
    },
    {
      at: "World.ts:866, resetVisCalc's working table: 53 = 2 * 26 + 1",
      find: /new TypedArray4d\(9, 32, 53, 53, false\)/g,
      count: 1,
      replace: `new TypedArray4d(9, 32, ${SIDE + 3}, ${SIDE + 3}, false)`,
    },
    {
      at: "World.ts:876-877, resetVisCalc's loops over it",
      find: /number = -26; (d[xz]) <= 26;/g,
      count: 2,
      replace: `number = -${TILES + 1}; $1 <= ${TILES + 1};`,
    },
    {
      at: "World.ts:889-918, resetVisCalc's indexes into it",
      find: / \+ 25 \+ 1\]/g,
      count: 10,
      replace: ` + ${TILES} + 1]`,
    },
    {
      at: "World.ts:897-898, resetVisCalc's loops over visBacking",
      find: /number = -25; ([xz]) < 25;/g,
      count: 2,
      replace: `number = -${TILES}; $1 < ${TILES};`,
    },
    {
      at: "World.ts:925, resetVisCalc's index into visBacking",
      find: /\[x \+ 25\]\[z \+ 25\]/g,
      count: 1,
      replace: `[x + ${TILES}][z + ${TILES}]`,
    },
    {
      at: "World.ts:938, testPoint's far clip",
      find: /pz > 3500\)/g,
      count: 1,
      replace: `pz > ${FAR})`,
    },
    {
      at: "World.ts:982-997, renderAll's bounds around the camera",
      find: /World\.g([xz]) ([-+]) 25;/g,
      count: 4,
      replace: `World.g$1 $2 ${TILES};`,
    },
    {
      at: "World.ts:1014, renderAll's index into visBacking",
      find: /\[x \+ 25 - World\.gx\]\[z \+ 25 - World\.gz\]/g,
      count: 1,
      replace: `[x + ${TILES} - World.gx][z + ${TILES} - World.gz]`,
    },
    {
      at: "World.ts:1030-1093, renderAll's fill loops",
      find: /number = -25; (d[xz]) <= 0;/g,
      count: 4,
      replace: `number = -${TILES}; $1 <= 0;`,
    },
    {
      at: "World.ts:1258-1360, calcOcclude's indexes into visBacking",
      find: /(occluder\.(?:min|max)Tile[XZ]) \+ 25 - World\.g([xz])/g,
      count: 10,
      replace: `$1 + ${TILES} - World.g$2`,
    },
    {
      at: "World.ts:1259 and 1301, calcOcclude's bounds",
      find: /deltaMaxY >= 0 && deltaMaxY <= 50\)/g,
      count: 2,
      replace: `deltaMaxY >= 0 && deltaMaxY <= ${SIDE})`,
    },
    {
      at: "World.ts:1266-1362, calcOcclude's clamps",
      find: /if \((deltaMaxTile[XZ]) > 50\) \{(\s+)\1 = 50;/g,
      count: 4,
      replace: `if ($1 > ${SIDE}) {$2$1 = ${SIDE};`,
    },
  ],
  "Model.ts": [
    {
      at: "Model.ts:1723, worldRender's far clip",
      find: /midZ >= 3500\)/g,
      count: 1,
      replace: `midZ >= ${FAR})`,
    },
  ],
};

/**
 * `World.ts` or `Model.ts` with the distance patched, or an error naming the
 * first place that is not where the spike found it.
 */
export function extendDrawDistance(file: "World.ts" | "Model.ts", source: string): string {
  let out = source;
  for (const patch of PATCHES[file]) {
    const found = out.match(patch.find)?.length ?? 0;
    if (found !== patch.count) {
      throw new Error(
        `far.ts: ${patch.at} (${patch.find}) matched ${found} times, not ${patch.count}. ` +
          `Client-TS has changed under scripts/scenes/far.ts: find where the draw distance ` +
          `lives now and update PATCHES before rendering, or the scenes come out half-patched.`,
      );
    }
    out = out.replace(patch.find, patch.replace);
  }
  return out;
}

bunPlugin({
  name: "scenes-far",
  setup(build) {
    for (const file of ["World.ts", "Model.ts"] as const) {
      build.onLoad({ filter: new RegExp(`/src/dash3d/${file.replace(".", "\\.")}$`) }, (args) => ({
        contents: extendDrawDistance(file, readFileSync(args.path, "utf8")),
        loader: "ts",
      }));
    }
  },
});
