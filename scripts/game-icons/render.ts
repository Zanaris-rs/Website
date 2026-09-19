/**
 * Draw every item icon and skill icon out of the engine's packed cache, using
 * the game client's own code to do it. Run through `scripts/update-game-icons.sh`
 * (`npm run icons:update`), which supplies the three paths below; the header
 * of that script says why it is built this way.
 *
 *   CLIENT_DIR  a Client-TS checkout of the revision the fleet runs
 *   ENGINE_DIR  an engine checkout whose `data/pack` has been built
 *   OUT_DIR     this repository
 */

import "./dom-shim.ts";

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import FileCache from "./cache.ts";
import { encodePng } from "./png.ts";

// --- the slice of Client-TS this uses -------------------------------------

type Jag = { read(name: string): Uint8Array | null };
type Sprite = {
  data: Int32Array;
  wi: number;
  hi: number;
  xof: number;
  yof: number;
  owi: number;
  ohi: number;
};

type JagFileClass = new (src: Uint8Array) => Jag;
type Pix32Class = { depack(jag: Jag, name: string, sprite: number): Sprite };
type Pix3DClass = {
  lowMem: boolean;
  unpackTextures(textures: Jag): void;
  initColourTable(brightness: number): void;
  initPool(size: number): void;
};
type ModelClass = {
  init(total: number, provider: { requestModel(id: number): void }): void;
  unpack(id: number, src: Uint8Array | null): void;
};
type ObjTypeClass = {
  numDefinitions: number;
  init(config: Jag, members: boolean): void;
  getSprite(id: number, count: number, outlineRgb: number): Sprite | null;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(
      `error: ${name} is not set; run this through scripts/update-game-icons.sh`,
    );
    process.exit(1);
  }
  return path.resolve(value);
}

const CLIENT_DIR = required("CLIENT_DIR");
const ENGINE_DIR = required("ENGINE_DIR");
const OUT_DIR = required("OUT_DIR");

async function client<T>(file: string): Promise<T> {
  return (await import(path.join(CLIENT_DIR, "src", file))).default as T;
}

const JagFile = await client<JagFileClass>("io/JagFile.ts");
const Pix32 = await client<Pix32Class>("graphics/Pix32.ts");
const Pix3D = await client<Pix3DClass>("dash3d/Pix3D.ts");
const Model = await client<ModelClass>("dash3d/Model.ts");
const ObjType = await client<ObjTypeClass>("config/ObjType.ts");

// --- the cache ------------------------------------------------------------

const PACK = path.join(ENGINE_DIR, "data/pack");

function jag(name: string): Jag {
  return new JagFile(readFileSync(path.join(PACK, "client", name)));
}

const config = jag("config");
const media = jag("media");
const textures = jag("textures");
const cache = new FileCache(PACK, 5);

// --- skills ---------------------------------------------------------------

/**
 * Engine stat id (`PlayerStat`) -> the sprite the client draws for it. The
 * stats tab and the XP lamp (`content/scripts/player/interfaces/stats.if`,
 * `content/scripts/general/interfaces/xplamp.if`) are where these pairs come
 * from; 18 and 19 are stats the 2004 game never shipped, so they have none.
 */
const SKILL_SPRITES: ReadonlyArray<
  readonly [stat: number, sheet: string, index: number]
> = [
  [0, "staticons", 0], // attack
  [1, "staticons", 2], // defence
  [2, "staticons", 1], // strength
  [3, "staticons", 6], // hitpoints
  [4, "staticons", 3], // ranged
  [5, "staticons", 4], // prayer
  [6, "staticons", 5], // magic
  [7, "staticons", 15], // cooking
  [8, "staticons", 17], // woodcutting
  [9, "staticons", 11], // fletching
  [10, "staticons", 14], // fishing
  [11, "staticons", 16], // firemaking
  [12, "staticons", 10], // crafting
  [13, "staticons", 13], // smithing
  [14, "staticons", 12], // mining
  [15, "staticons", 8], // herblore
  [16, "staticons", 7], // agility
  [17, "staticons", 9], // thieving
  [20, "staticons2", 0], // runecraft
];

/**
 * Two stats-tab icons are flat black silhouettes, which read in game against
 * grey stone and vanish against this site's black panels. The 2004 website
 * had the same problem and repainted them in one colour each for its hiscores
 * (`git -C engine show f2c4d3ed^:public/img/hiscores/agility.gif`); these
 * are its colours, applied to the same black.
 */
const WEB_COLOURS: ReadonlyMap<number, number> = new Map([
  [16, 0x564b3a], // agility, brown
  [17, 0x6b0000], // thieving, dark red
]);

/** The client's black: palette black is stored as 1, since 0 is transparent. */
const BLACK = 1;

/** A sprite at its full cell size, trimmed margins restored as transparency. */
function uncrop(sprite: Sprite): Int32Array {
  const out = new Int32Array(sprite.owi * sprite.ohi);
  for (let y = 0; y < sprite.hi; y++) {
    for (let x = 0; x < sprite.wi; x++) {
      out[x + sprite.xof + (y + sprite.yof) * sprite.owi] =
        sprite.data[x + y * sprite.wi];
    }
  }
  return out;
}

function fresh(dir: string): string {
  const full = path.join(OUT_DIR, dir);
  rmSync(full, { recursive: true, force: true });
  mkdirSync(full, { recursive: true });
  return full;
}

const skillsDir = fresh("public/img/game/skills");
for (const [stat, sheet, index] of SKILL_SPRITES) {
  const sprite = Pix32.depack(media, sheet, index);
  const pixels = uncrop(sprite);
  const colour = WEB_COLOURS.get(stat);
  if (colour !== undefined) {
    for (let i = 0; i < pixels.length; i++) {
      if (pixels[i] === BLACK) pixels[i] = colour;
    }
  }
  writeFileSync(
    path.join(skillsDir, `${stat}.png`),
    encodePng(pixels, sprite.owi, sprite.ohi),
  );
}
console.log(
  `skills   ${SKILL_SPRITES.length} -> public/img/game/skills/<stat>.png`,
);

// --- items ----------------------------------------------------------------

// The client's own start-up order (Client.ts, "Unpacking textures" onwards).
Pix3D.lowMem = false;
Pix3D.unpackTextures(textures);
// The client nudges its brightness by up to ±0.015 at random, so no two
// sessions shade a model identically. Pinned to the midpoint here, the same
// pack always gives the same bytes and re-running leaves `git status` clean.
const random = Math.random;
Math.random = () => 0.5;
Pix3D.initColourTable(0.8);
Math.random = random;
Pix3D.initPool(20);
ObjType.init(config, true);

const modelCount = cache.count(1);
Model.init(modelCount, {
  requestModel(id: number) {
    throw new Error(`model ${id} is not in the cache (${modelCount} models)`);
  },
});
for (let id = 0; id < modelCount; id++) {
  Model.unpack(id, cache.readGzip(1, id));
}

const itemsDir = fresh("public/img/game/items");
const blank: number[] = [];
for (let id = 0; id < ObjType.numDefinitions; id++) {
  // Count 1 and outline 0: an inventory slot holding one, drop shadow and all.
  const icon = ObjType.getSprite(id, 1, 0);
  // No model, or one that draws nothing into the 32x32 box — the content's
  // `floor_invisableicon_0` / `basic_blank_model_0` placeholders, mostly. The
  // client shows an empty slot for these, so there is no icon to write.
  if (!icon || icon.data.every((rgb) => rgb === 0)) {
    blank.push(id);
    continue;
  }
  writeFileSync(path.join(itemsDir, `${id}.png`), encodePng(icon.data, 32, 32));
}

const drawn = ObjType.numDefinitions - blank.length;
console.log(`items    ${drawn} -> public/img/game/items/<id>.png`);
console.log(
  `         ${blank.length} drawn blank by the client: ${blank.join(", ") || "none"}`,
);

const manifest = path.join(OUT_DIR, "lib/items/icons.json");
writeFileSync(
  manifest,
  JSON.stringify({ count: ObjType.numDefinitions, blank }) + "\n",
);
console.log(`wrote    lib/items/icons.json`);

// --- cross-check against the names the economy pages print -----------------

const namesFile = path.join(OUT_DIR, "lib/items/names.json");
if (existsSync(namesFile)) {
  const named = Object.keys(JSON.parse(readFileSync(namesFile, "utf8"))).map(
    Number,
  );
  const unknown = named.filter((id) => id >= ObjType.numDefinitions);
  if (unknown.length > 0) {
    console.log(
      `warning  ${unknown.length} ids in lib/items/names.json are past the pack's ${ObjType.numDefinitions}`,
    );
    console.log(
      `         objects: ${unknown.join(", ")}. The engine pack is older than the`,
    );
    console.log(
      `         content names.json was made from; repack the engine and re-run.`,
    );
  } else {
    console.log(`check    every id in lib/items/names.json is in the pack`);
  }
}
