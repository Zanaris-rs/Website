/**
 * Export what the site needs to draw chatheads, and the pictures that prove
 * it draws them right. Run through `scripts/update-chathead.sh`
 * (`npm run chathead:update`), which bundles the renderer first and supplies
 * the three paths below; the header of that script says why it is built this
 * way.
 *
 *   CLIENT_DIR  a Client-TS checkout of the revision the fleet runs
 *   ENGINE_DIR  an engine checkout whose `data/pack` has been built
 *   OUT_DIR     this repository
 *
 * Writes `public/game/chathead/models.bin`, `lib/chathead/heads.json` and
 * `lib/chathead/golden.json`; through `outfits.ts` what the outfit editor
 * draws the Worn Equipment tab with; and through `bodies.ts` what the site
 * draws a whole body with, and its golden pictures.
 */

import "./browser-stub.ts";

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { Client, ClientModel } from "../../lib/chathead/client.ts";
import { prepare } from "../../lib/chathead/client.ts";
import { BACKGROUND, drawModel, light } from "../../lib/chathead/draw.ts";
import type { HeadTables } from "../../lib/chathead/head.ts";
import { type Look, toAppearance } from "../../lib/chathead/look.ts";
import { encodeModels } from "../../lib/chathead/models.ts";
import FileCache from "../game-icons/cache.ts";
import { type BodyInputs, exportBodies } from "./bodies.ts";
import { exportOutfitEditor, type SpriteClient } from "./outfits.ts";
import { readWearPos } from "./server-obj.ts";
import { readParamTypes } from "./server-param.ts";

// --- the slice of Client-TS this uses -------------------------------------

type Jag = { read(name: string): Uint8Array | null };
type JagFileClass = new (src: Uint8Array) => Jag;
type ModelClass = Client["Model"] & {
  copyForAnim(
    src: ClientModel,
    shareColours: boolean,
    shareAlpha: boolean,
    shareVertices: boolean,
  ): ClientModel;
};
type IdkTypeClass = {
  init(config: Jag): void;
  list: {
    part: number;
    disable: boolean;
    head: Int32Array;
    recol_s: Int32Array;
    recol_d: Int32Array;
  }[];
};
type ObjTypeClass = {
  numDefinitions: number;
  init(config: Jag, members: boolean): void;
  list(id: number): {
    manhead: number;
    manhead2: number;
    womanhead: number;
    womanhead2: number;
    recol_s: Uint16Array | null;
    recol_d: Uint16Array | null;
  };
};
type ClientPlayerClass = {
  recol1d: number[][];
  recol2d: number[];
  new (): {
    ready: boolean;
    gender: number;
    appearance: Uint16Array;
    colour: Uint16Array;
    getHeadModel(): ClientModel | null;
  };
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(
      `error: ${name} is not set; run this through scripts/update-chathead.sh`,
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
const Model = await client<ModelClass>("dash3d/Model.ts");
const Pix3D = await client<Client["Pix3D"] & { colourTable: Int32Array }>(
  "dash3d/Pix3D.ts",
);
const Pix2D = await client<Client["Pix2D"]>("graphics/Pix2D.ts");
const Pix8 = await client<SpriteClient["Pix8"]>("graphics/Pix8.ts");
const Pix32 = await client<SpriteClient["Pix32"]>("graphics/Pix32.ts");
const AnimFrame = await client<Client["AnimFrame"]>("dash3d/AnimFrame.ts");
const IdkType = await client<IdkTypeClass & BodyInputs["IdkType"]>("config/IdkType.ts");
const ObjType = await client<ObjTypeClass & BodyInputs["ObjType"]>("config/ObjType.ts");
const SeqType = await client<BodyInputs["SeqType"] & { init(config: Jag): void }>(
  "config/SeqType.ts",
);
const ClientPlayer = await client<ClientPlayerClass & BodyInputs["ClientPlayer"]>(
  "dash3d/ClientPlayer.ts",
);

const source: Client = { Model, Pix3D, Pix2D, AnimFrame };

// --- the cache ------------------------------------------------------------

const PACK = path.join(ENGINE_DIR, "data/pack");
const config = new JagFile(readFileSync(path.join(PACK, "client/config")));
const media = new JagFile(readFileSync(path.join(PACK, "client/media")));
const textures = new JagFile(readFileSync(path.join(PACK, "client/textures")));
const cache = new FileCache(PACK, 5);

// The client's start-up order, as `loadBodies` repeats it in the browser:
// the textures (a few body models use them; no head does), the colour
// table, which holds their palettes, and room to expand them.
Pix3D.unpackTextures(textures);
prepare(source);
Pix3D.initPool(20);
IdkType.init(config);
ObjType.init(config, true);
SeqType.init(config);

const modelTotal = cache.count(1);
Model.init(modelTotal, {
  requestModel(id: number) {
    throw new Error(`model ${id} is not in the cache (${modelTotal} models)`);
  },
});
for (let id = 0; id < modelTotal; id++) {
  Model.unpack(id, cache.readGzip(1, id));
}

// --- tables ---------------------------------------------------------------

/** Appearance slots a chathead can show: the hat, the hair and the jaw. */
const HEAD_SLOTS = new Set([0, 8, 11]);

const headModels = new Set<number>();

const kits: HeadTables["kits"][number][] = IdkType.list.map((kit) => {
  const head = [...kit.head].filter((model) => model !== -1);
  head.forEach((model) => headModels.add(model));
  // `getHeadNoCheck` stops at the first empty source colour, and at six.
  const recol: [number, number][] = [];
  for (let i = 0; i < 6 && kit.recol_s[i] !== 0; i++) {
    recol.push([kit.recol_s[i], kit.recol_d[i]]);
  }
  return { part: kit.part, selectable: !kit.disable, head, recol };
});

const objs: Record<string, HeadTables["objs"][string]> = {};
for (let id = 0; id < ObjType.numDefinitions; id++) {
  // `list` hands out one of ten recycled instances: copy, don't keep.
  const obj = ObjType.list(id);
  const man = [obj.manhead, obj.manhead2].filter((model) => model !== -1);
  const woman = [obj.womanhead, obj.womanhead2].filter((m) => m !== -1);
  // The client ignores a second head model without a first.
  if (obj.manhead === -1) man.length = 0;
  if (obj.womanhead === -1) woman.length = 0;
  if (man.length === 0 && woman.length === 0) continue;

  [...man, ...woman].forEach((model) => headModels.add(model));
  const recol: [number, number][] = [];
  if (obj.recol_s && obj.recol_d) {
    for (let i = 0; i < obj.recol_s.length; i++) {
      recol.push([obj.recol_s[i], obj.recol_d[i]]);
    }
  }
  objs[id] = { man, woman, recol };
}

const wearpos = readWearPos(path.join(PACK, "server/obj.dat"));
if (wearpos.length !== ObjType.numDefinitions) {
  throw new Error(
    `server/obj.dat has ${wearpos.length} objects, client config has ` +
      `${ObjType.numDefinitions}: the pack is half-built; repack the engine`,
  );
}
const hides: Record<string, number[]> = {};
wearpos.forEach(({ wearpos2, wearpos3 }, id) => {
  const slots = [wearpos2, wearpos3].filter((slot) => HEAD_SLOTS.has(slot));
  if (slots.length > 0) hides[id] = slots;
});

// --- golden looks ---------------------------------------------------------

/** The engine's new-player look (`Player.body`). */
const MALE_KITS = [0, 10, 18, 26, 33, 36, 42];
/** A female look: her first selectable kit for each part, and no jaw. */
const FEMALE_KITS = [0, 1, 2, 3, 4, 5, 6].map((part) =>
  part === 1 ? -1 : kits.findIndex((k) => k.part === part + 7 && k.selectable),
);
const NO_COLOURS = [0, 0, 0, 0, 0];
const NOTHING_WORN = new Array<number>(14).fill(-1);

function look(
  gender: number,
  change: { kits?: number[]; colours?: number[]; worn?: [number, number] } = {},
): Look {
  const worn = [...NOTHING_WORN];
  if (change.worn) worn[change.worn[0]] = change.worn[1];
  return {
    gender,
    kits: change.kits ?? (gender === 1 ? FEMALE_KITS : MALE_KITS),
    colours: change.colours ?? NO_COLOURS,
    worn,
  };
}

const golden: { name: string; look: Look }[] = [
  { name: "male default", look: look(0) },
  { name: "female default", look: look(1) },
  {
    name: "no kits",
    look: { ...look(0), kits: [-1, -1, -1, -1, -1, -1, -1] },
  },
];

// Every kit with a head, in its own slot on its own gender's default.
kits.forEach((kit, id) => {
  if (kit.head.length === 0) return;
  const gender = kit.part >= 7 ? 1 : 0;
  const slot = kit.part % 7;
  const base = [...(gender === 1 ? FEMALE_KITS : MALE_KITS)];
  base[slot] = id;
  golden.push({ name: `kit ${id}`, look: look(gender, { kits: base }) });
});

// Every object with a head model, worn where it is worn, on both genders.
for (const id of Object.keys(objs).map(Number)) {
  const slot = wearpos[id].wearpos >= 0 ? wearpos[id].wearpos : 0;
  for (const gender of [0, 1]) {
    golden.push({
      name: `obj ${id} ${gender === 1 ? "female" : "male"}`,
      look: look(gender, { worn: [slot, id] }),
    });
  }
}

// Every colour of every part, one part at a time.
ClientPlayer.recol1d.forEach((palette, part) => {
  for (let colour = 1; colour < palette.length; colour++) {
    const colours = [...NO_COLOURS];
    colours[part] = colour;
    for (const gender of [0, 1]) {
      golden.push({
        name: `colour part ${part} = ${colour} ${gender ? "female" : "male"}`,
        look: look(gender, { colours }),
      });
    }
  }
});

// --- reference drawing ----------------------------------------------------

/**
 * The client's own head for a look — `ClientPlayer.getHeadModel`, then the
 * copy and light `IfType.getTempModel` gives a model component — drawn with
 * the site's `drawModel`. Only the appearance slots are built by the site's
 * code; `lib/chathead/look.test.ts` checks those against the engine's rules.
 */
function reference(entry: Look, frame: HeadTables["frame"]): Int32Array {
  const player = new ClientPlayer();
  player.ready = true;
  player.gender = entry.gender;
  player.appearance.set(toAppearance(entry, hides));
  player.colour.set(entry.colours);

  const head = player.getHeadModel();
  if (!head) throw new Error("the client built no head");
  // AnimFrame.animateTransparencies(-1) is true: no animation, alpha shared.
  const lit = Model.copyForAnim(head, true, true, false);
  light(lit);
  return drawModel(source, lit, frame);
}

function isBlank(pixels: Int32Array): boolean {
  return pixels.every((rgb) => rgb === BACKGROUND);
}

/**
 * Size the frame from the heads themselves. Each golden look is drawn into a
 * generous box and measured, relative to the origin.
 *
 * Every hair, beard and colour must fit whole: those are the face. Hats are
 * another matter — the pointed snelms stand 168 pixels above the face and
 * the Warrior helm's horns are 180 wide, against a head about 90 tall, and a
 * frame that fit them would draw every other head as a speck in the middle
 * of it. So the frame also fits the hats up to HAT_FIT, and the few beyond
 * are cut off at its edge, much as the dialogue box cuts them in game.
 */
const HAT_FIT = 0.9;
const PROBE = { width: 512, height: 512, originX: 256, originY: 256 };

type Extent = { left: number; top: number; right: number; bottom: number };

function measure(entry: Look): Extent {
  const pixels = reference(entry, PROBE);
  const extent = { left: 0, top: 0, right: 0, bottom: 0 };
  for (let y = 0; y < PROBE.height; y++) {
    for (let x = 0; x < PROBE.width; x++) {
      if (pixels[x + y * PROBE.width] === BACKGROUND) continue;
      if (x === 0 || y === 0 || x === PROBE.width - 1 || y === PROBE.height - 1) {
        throw new Error("a head reached the edge of the probe box; make it bigger");
      }
      extent.left = Math.min(extent.left, x - PROBE.originX);
      extent.right = Math.max(extent.right, x - PROBE.originX);
      extent.top = Math.min(extent.top, y - PROBE.originY);
      extent.bottom = Math.max(extent.bottom, y - PROBE.originY);
    }
  }
  return extent;
}

/** The value `share` of the values lie at or inside (toward 0). */
function within(values: number[], share: number): number {
  const sorted = [...values].sort((a, b) => Math.abs(a) - Math.abs(b));
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * share) - 1)];
}

const faces: Extent[] = [];
const hats: Extent[] = [];
for (const { name, look: entry } of golden) {
  (name.startsWith("obj ") ? hats : faces).push(measure(entry));
}

const bounds: Extent = { left: 0, top: 0, right: 0, bottom: 0 };
for (const side of ["left", "top", "right", "bottom"] as const) {
  const face = faces.map((extent) => extent[side]);
  const hat = within(hats.map((extent) => extent[side]), HAT_FIT);
  const outward = side === "left" || side === "top" ? Math.min : Math.max;
  bounds[side] = outward(...face, hat);
}
const cut = hats.filter(
  (extent) =>
    extent.left < bounds.left ||
    extent.top < bounds.top ||
    extent.right > bounds.right ||
    extent.bottom > bounds.bottom,
).length;

// A pixel of air on every side.
const frame: HeadTables["frame"] = {
  width: bounds.right - bounds.left + 3,
  height: bounds.bottom - bounds.top + 3,
  originX: 1 - bounds.left,
  originY: 1 - bounds.top,
};

function hash(pixels: Int32Array): string {
  return createHash("sha256")
    .update(new Uint8Array(pixels.buffer))
    .digest("hex")
    .slice(0, 16);
}

const goldenFile = golden.map(({ name, look: entry }) => {
  const pixels = reference(entry, frame);
  return { name, look: entry, hash: isBlank(pixels) ? null : hash(pixels) };
});

// --- write ----------------------------------------------------------------

const models = new Map<number, Uint8Array>();
for (const id of headModels) {
  const bytes = cache.readGzip(1, id);
  if (!bytes) throw new Error(`head model ${id} is not in the cache`);
  models.set(id, bytes);
}
const modelsBin = encodeModels({ total: modelTotal, models });
writeFileSync(path.join(OUT_DIR, "public/game/chathead/models.bin"), modelsBin);

const body = {
  kits,
  objs,
  hides,
  recol1d: ClientPlayer.recol1d.map((palette) => [...palette]),
  recol2d: [...ClientPlayer.recol2d],
  frame,
};

/**
 * One version for the renderer, the models and the tables together: the
 * site asks for `renderer.js?v=` and `models.bin?v=`, cached for a year
 * (`next.config.ts`), so anything that changes a picture changes every URL.
 */
const version = createHash("sha256")
  .update(readFileSync(path.join(OUT_DIR, "public/game/chathead/renderer.js")))
  .update(modelsBin)
  .update(JSON.stringify(body))
  .digest("hex")
  .slice(0, 8);

const tables: HeadTables = { version, ...body };
writeFileSync(
  path.join(OUT_DIR, "lib/chathead/heads.json"),
  JSON.stringify(tables) + "\n",
);
writeFileSync(
  path.join(OUT_DIR, "lib/chathead/golden.json"),
  JSON.stringify({ version, looks: goldenFile }, null, 1) + "\n",
);

const bodies = exportBodies({
  source,
  IdkType,
  ObjType,
  SeqType,
  ClientPlayer,
  cache,
  modelTotal,
  textures,
  wearpos,
  params: readParamTypes(path.join(PACK, "server/param.dat")),
  recol1d: ClientPlayer.recol1d,
  recol2d: ClientPlayer.recol2d,
  maleKits: MALE_KITS,
  femaleKits: FEMALE_KITS,
  outDir: OUT_DIR,
});

const wearables = exportOutfitEditor({
  client: { Pix2D, Pix8, Pix32, colourTable: Pix3D.colourTable },
  media,
  wearpos,
  recol1d: ClientPlayer.recol1d,
  outDir: OUT_DIR,
});

const drawn = goldenFile.filter((entry) => entry.hash !== null).length;
console.log(
  `models   ${models.size} head models, ${modelsBin.length} bytes -> public/game/chathead/models.bin?v=${version}`,
);
console.log(
  `tables   ${kits.length} kits, ${Object.keys(objs).length} objects with heads, ${Object.keys(hides).length} that hide head slots -> lib/chathead/heads.json`,
);
console.log(
  `frame    ${frame.width}x${frame.height}, origin ${frame.originX},${frame.originY}; ` +
    `${cut} of ${hats.length} hat looks cut off at its edge`,
);
console.log(
  `golden   ${goldenFile.length} looks (${drawn} drawn, ${goldenFile.length - drawn} blank) -> lib/chathead/golden.json`,
);
console.log(
  `bodies   ${bodies.models} body models, ${bodies.textures.length} textures (${bodies.textures.join(", ")}), ` +
    `${bodies.stances} stances for ${bodies.weapons} weapons in ${bodies.anims.length} cut anim files ` +
    `(${bodies.anims.join(" + ")} bytes), ${bodies.bytes} bytes -> public/game/chathead/bodies.bin?v=${bodies.version}`,
);
console.log(
  `         ${bodies.objs} worn objects, ${bodies.hides} that empty a slot -> lib/chathead/bodies.json`,
);
console.log(
  `figure   ${bodies.frame.width}x${bodies.frame.height}, origin ${bodies.frame.originX},${bodies.frame.originY}, ` +
    `every golden look whole -> lib/chathead/figure.json`,
);
console.log(
  `         ${bodies.golden} golden looks (${bodies.drawn} drawn, ${bodies.golden - bodies.drawn} blank) -> lib/chathead/figure-golden.json`,
);
const wearableCount = Object.values(wearables.slots).flat().length;
console.log(
  `outfits  ${wearableCount} wearable objects in ${Object.keys(wearables.slots).length} slots, the worn tab and its silhouettes -> public/img/game/worn/*.png?v=${wearables.version}, lib/chathead/wearables.json`,
);
process.exit(0);
