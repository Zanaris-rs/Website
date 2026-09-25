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

import { createHash } from "node:crypto";
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
type Pix2DClass = {
  setPixels(pixels: Int32Array, width: number, height: number): void;
  fillRect(x: number, y: number, width: number, height: number, rgb: number): void;
};
type Pix3DClass = {
  lowMem: boolean;
  lowDetail: boolean;
  originX: number;
  originY: number;
  sinTable: Int32Array;
  cosTable: Int32Array;
  unpackTextures(textures: Jag): void;
  initColourTable(brightness: number): void;
  initPool(size: number): void;
  setRenderClipping(): void;
};
type ModelClass = {
  init(total: number, provider: { requestModel(id: number): void }): void;
  unpack(id: number, src: Uint8Array | null): void;
};
/** The slice of a drawable model the icon pose needs. */
type ObjModel = {
  minY: number;
  objRender(
    pitch: number,
    yaw: number,
    roll: number,
    eyePitch: number,
    eyeX: number,
    eyeY: number,
    eyeZ: number,
  ): void;
};
/** One object's own idea of how it should be drawn, from the config archive. */
type Obj = {
  zoom2d: number;
  xan2d: number;
  yan2d: number;
  zan2d: number;
  xof2d: number;
  yof2d: number;
  getModelLit(count: number): ObjModel | null;
};
type ObjTypeClass = {
  numDefinitions: number;
  init(config: Jag, members: boolean): void;
  list(id: number): Obj;
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
const Pix2D = await client<Pix2DClass>("graphics/Pix2D.ts");
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

/**
 * Write a set of icons and return its version: a hash of everything in it.
 *
 * The icons are cached for a year (`next.config.ts`), which is only safe
 * because the helpers put this version in the URL — the filenames are object
 * ids, so a file's bytes change when its model does, and nothing can purge a
 * browser cache. A regeneration that changes any icon changes the version,
 * which changes every URL in the set, and readers see the new pictures at
 * once. The two sets are hashed apart so that a run which only moves an item
 * model leaves the skill icons' URLs, and their caches, alone.
 */
function writeSet(dir: string, files: [name: string, bytes: Buffer][]): string {
  const hash = createHash("sha256");
  for (const [name, bytes] of files) {
    writeFileSync(path.join(dir, name), bytes);
    hash.update(name);
    hash.update(bytes);
  }
  return hash.digest("hex").slice(0, 8);
}

const skillFiles: [string, Buffer][] = [];
for (const [stat, sheet, index] of SKILL_SPRITES) {
  const sprite = Pix32.depack(media, sheet, index);
  const pixels = uncrop(sprite);
  const colour = WEB_COLOURS.get(stat);
  if (colour !== undefined) {
    for (let i = 0; i < pixels.length; i++) {
      if (pixels[i] === BLACK) pixels[i] = colour;
    }
  }
  skillFiles.push([`${stat}.png`, encodePng(pixels, sprite.owi, sprite.ohi)]);
}
const skillsVersion = writeSet(fresh("public/img/game/skills"), skillFiles);
writeFileSync(
  path.join(OUT_DIR, "lib/skills/icons.json"),
  JSON.stringify({ version: skillsVersion }) + "\n",
);
console.log(
  `skills   ${skillFiles.length} -> public/img/game/skills/<stat>.png?v=${skillsVersion}`,
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

const itemFiles: [string, Buffer][] = [];
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
  itemFiles.push([`${id}.png`, encodePng(icon.data, 32, 32)]);
}
const itemsVersion = writeSet(fresh("public/img/game/items"), itemFiles);

console.log(
  `items    ${itemFiles.length} -> public/img/game/items/<id>.png?v=${itemsVersion}`,
);
console.log(
  `         ${blank.length} drawn blank by the client: ${blank.join(", ") || "none"}`,
);

const manifest = path.join(OUT_DIR, "lib/items/icons.json");
writeFileSync(
  manifest,
  JSON.stringify({
    version: itemsVersion,
    count: ObjType.numDefinitions,
    blank,
  }) + "\n",
);
console.log(`wrote    lib/items/icons.json, lib/skills/icons.json`);

// --- menu tiles -----------------------------------------------------------

/**
 * The title screen's menu pictures are 77x120 (`components/site/MenuTile.tsx`).
 * 2004's own are photographs of props Jagex modelled for its website, and
 * `scripts/vendor-2004-assets.sh` recovers those. Three of our pages are pages
 * 2004 never had, and no tile it drew is about them, so we draw the game's own
 * answer instead: an object's model, lit and posed exactly as its inventory
 * icon is, in a tile-shaped box on black.
 *
 * The client draws icons into 32x32, and a tile straight from it would be a
 * handful of fat pixels next to smooth neighbours. Each one is drawn at
 * SUPERSAMPLE times the final size and averaged down, which is where the
 * smooth edges come from. Deterministic like everything else here: the same
 * pack writes the same bytes.
 *
 * They are a third versioned set, hashed apart from the icons: `lib/title/
 * tiles.json` carries the version and `titleTileSrc` puts it in the URL,
 * because /img/game is cached for a year (`next.config.ts`).
 */

const TILE_WIDTH = 77;
const TILE_HEIGHT = 120;
const SUPERSAMPLE = 4;

type TileSpec = {
  /** Written to `public/img/game/tiles/<file>.png`. */
  file: string;
  obj: number;
  /** The object's name, for the log line and for reading this table. */
  what: string;
  /** Size in inventory icons: 1 draws it 32 tile-pixels across, 2 draws 64. */
  scale: number;
  /** Turntable angle (0-2047) when the icon's own pose is not the best one. */
  yan?: number;
  /** Roll (0-2047): the angle it leans at on the page, anticlockwise. */
  zan?: number;
  /** Camera pitch (0-2047): lower looks at it more from the side. */
  xan?: number;
  /** Nudge in tile pixels, positive right and down. */
  x?: number;
  y?: number;
};

const TILES: readonly TileSpec[] = [
  // LostHQ, a wiki: an instrument for working out where you are, which is
  // what its guides and calculators are for. Lifted, because the icon hangs
  // it in the bottom of the frame.
  { file: "sextant", obj: 2574, what: "Sextant", scale: 2.6, y: -14 },
  // Zanaris Kit, a client: the staff you have to be holding to reach Zanaris
  // at all. Rolled up out of the icon's lazy diagonal and dropped a little,
  // so it climbs the tall tile with its gnarled head high and clear; the
  // icon's steep camera looks along a staff and makes a stick of it, so this
  // one stands further back and catches the light down its length.
  {
    file: "dramen-staff",
    obj: 772,
    what: "Dramen staff",
    scale: 3.0,
    zan: 170,
    xan: 100,
    y: -4,
  },
  // Adventurer Logs, a diary of what every player has done: the game's own
  // book, in the pose its icon has, which already stands it up to be read.
  { file: "book", obj: 1509, what: "Book", scale: 2.8 },
];

/** One tile at SUPERSAMPLE size, straight out of the client's renderer. */
function drawTile(spec: TileSpec): Int32Array {
  const obj = ObjType.list(spec.obj);
  const model = obj.getModelLit(1);
  if (!model) {
    throw new Error(`object ${spec.obj} (${spec.what}) has no model`);
  }

  const width = TILE_WIDTH * SUPERSAMPLE;
  const height = TILE_HEIGHT * SUPERSAMPLE;
  const pixels = new Int32Array(width * height);

  Pix3D.lowDetail = false;
  Pix2D.setPixels(pixels, width, height);
  Pix2D.fillRect(0, 0, width, height, BLACK);
  Pix3D.setRenderClipping();
  Pix3D.originX += Math.round((spec.x ?? 0) * SUPERSAMPLE);
  Pix3D.originY += Math.round((spec.y ?? 0) * SUPERSAMPLE);

  // Size is the camera's distance and nothing else: the object's own zoom is
  // the one that fills 32 pixels, so dividing it by the number of 32-pixel
  // widths we asked for (times the supersample) fills that instead. The
  // object's centring offsets are in front of the camera, so they shrink with
  // it; `minY` is the model's own height and does not.
  const fill = spec.scale * SUPERSAMPLE;
  const pitch = spec.xan ?? obj.xan2d;
  const zoom = Math.max(1, (obj.zoom2d / fill) | 0);
  const sinPitch = (Pix3D.sinTable[pitch] * zoom) >> 16;
  const cosPitch = (Pix3D.cosTable[pitch] * zoom) >> 16;
  const xof = (obj.xof2d / fill) | 0;
  const yof = (obj.yof2d / fill) | 0;

  model.objRender(
    0,
    spec.yan ?? obj.yan2d,
    spec.zan ?? obj.zan2d,
    pitch,
    xof,
    sinPitch + ((model.minY / 2) | 0) + yof,
    cosPitch + yof,
  );
  Pix3D.lowDetail = true;

  return pixels;
}

/** Average each SUPERSAMPLE x SUPERSAMPLE block down to one pixel. */
function shrink(pixels: Int32Array): Int32Array {
  const width = TILE_WIDTH * SUPERSAMPLE;
  const block = SUPERSAMPLE * SUPERSAMPLE;
  const out = new Int32Array(TILE_WIDTH * TILE_HEIGHT);
  for (let y = 0; y < TILE_HEIGHT; y++) {
    for (let x = 0; x < TILE_WIDTH; x++) {
      let red = 0;
      let green = 0;
      let blue = 0;
      for (let dy = 0; dy < SUPERSAMPLE; dy++) {
        const row = (y * SUPERSAMPLE + dy) * width + x * SUPERSAMPLE;
        for (let dx = 0; dx < SUPERSAMPLE; dx++) {
          const rgb = pixels[row + dx];
          red += (rgb >> 16) & 0xff;
          green += (rgb >> 8) & 0xff;
          blue += rgb & 0xff;
        }
      }
      const rgb =
        (((red / block) | 0) << 16) |
        (((green / block) | 0) << 8) |
        ((blue / block) | 0);
      // A tile is opaque: 0 is the encoder's transparent, so black is 1.
      out[x + y * TILE_WIDTH] = rgb === 0 ? BLACK : rgb;
    }
  }
  return out;
}

const tileFiles: [string, Buffer][] = TILES.map((spec) => [
  `${spec.file}.png`,
  encodePng(shrink(drawTile(spec)), TILE_WIDTH, TILE_HEIGHT),
]);
const tilesVersion = writeSet(fresh("public/img/game/tiles"), tileFiles);
writeFileSync(
  path.join(OUT_DIR, "lib/title/tiles.json"),
  JSON.stringify({
    version: tilesVersion,
    names: TILES.map((spec) => spec.file),
  }) + "\n",
);
console.log(
  `tiles    ${TILES.length} -> public/img/game/tiles/<name>.png?v=${tilesVersion} (${TILE_WIDTH}x${TILE_HEIGHT}): ` +
    TILES.map((tile) => tile.what).join(", "),
);
console.log(`wrote    lib/title/tiles.json`);

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
