/**
 * Write every texture in the engine's pack as a PNG, using the game client's
 * own code to unpack and shade them. Run through
 * `scripts/update-game-textures.sh` (`npm run textures:update`), which
 * supplies the paths below; the header of that script says why it is built
 * this way.
 *
 *   CLIENT_DIR   a Client-TS checkout of the revision the fleet runs
 *   ENGINE_DIR   an engine checkout whose `data/pack` has been built
 *   CONTENT_DIR  the content the engine packs from, for the textures' names
 *   OUT_DIR      this repository
 */

import "./dom-shim.ts";

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { encodePng } from "./png.ts";

// --- the slice of Client-TS this uses -------------------------------------

type Jag = { read(name: string): Uint8Array | null };
type JagFileClass = new (src: Uint8Array) => Jag;
/** A palette sprite: one byte per pixel, indexing a palette. */
type Pix8 = { data: Int8Array; wi: number; hi: number };
type Pix3DClass = {
  lowMem: boolean;
  textures: (Pix8 | null)[];
  /** Each texture's palette after the brightness curve, set by initColourTable. */
  texPal: (Int32Array | null)[];
  unpackTextures(textures: Jag): void;
  initColourTable(brightness: number): void;
};

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`error: ${name} is not set; run this through scripts/update-game-textures.sh`);
    process.exit(1);
  }
  return path.resolve(value);
}

const CLIENT_DIR = required("CLIENT_DIR");
const ENGINE_DIR = required("ENGINE_DIR");
const CONTENT_DIR = required("CONTENT_DIR");
const OUT_DIR = required("OUT_DIR");

async function client<T>(file: string): Promise<T> {
  return (await import(path.join(CLIENT_DIR, "src", file))).default as T;
}

const JagFile = await client<JagFileClass>("io/JagFile.ts");
const Pix3D = await client<Pix3DClass>("dash3d/Pix3D.ts");

// --- the textures, as the client loads them --------------------------------

const PACK = path.join(ENGINE_DIR, "data/pack");
const archive = new JagFile(readFileSync(path.join(PACK, "client/textures")));

// The client's own start-up order (Client.ts, "Unpacking textures" onwards):
// unpack, then build the palettes with the brightness curve. Not low memory,
// so each texture keeps its full size. The client nudges its brightness by up
// to ±0.015 at random; pinned to the midpoint, as for the item icons, so the
// same pack always writes the same bytes.
Pix3D.lowMem = false;
Pix3D.unpackTextures(archive);
const random = Math.random;
Math.random = () => 0.5;
Pix3D.initColourTable(0.8);
Math.random = random;

// --- their names -------------------------------------------------------------

/** `id=name` per line, the content's own list of what each texture is. */
function names(): Map<number, string> {
  const file = path.join(CONTENT_DIR, "pack/texture.pack");
  const out = new Map<number, string>();
  if (!existsSync(file)) {
    console.log(`note     ${file} is missing; the textures will have numbers, not names`);
    return out;
  }
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^(\d+)=([a-z0-9_]+)$/.exec(line.trim());
    if (match) out.set(Number(match[1]), match[2]);
  }
  return out;
}

const named = names();

// --- write them ----------------------------------------------------------------

type Entry = { id: number; name: string; size: number };

const entries: Entry[] = [];
const files: [name: string, bytes: Buffer][] = [];

for (let id = 0; id < Pix3D.textures.length; id++) {
  const texture = Pix3D.textures[id];
  const palette = Pix3D.texPal[id];
  if (!texture || !palette) continue;
  if (texture.wi !== texture.hi) {
    throw new Error(`texture ${id} is ${texture.wi}x${texture.hi}; every 2004 texture is square`);
  }

  // Exactly the texel the rasteriser samples (Pix3D.getTexture): the shaded
  // palette colour with the low bits the client drops, and 0 a hole. The
  // client reads the index as a signed byte; unsigned here, which is the
  // same for every texture in the 2004 pack (none has 128 colours).
  const pixels = new Int32Array(texture.wi * texture.hi);
  for (let i = 0; i < pixels.length; i++) {
    pixels[i] = (palette[texture.data[i] & 0xff] ?? 0) & 0xf8f8ff;
  }
  files.push([`${id}.png`, encodePng(pixels, texture.wi, texture.hi)]);
  entries.push({ id, name: named.get(id) ?? "", size: texture.wi });
}

/**
 * The set's version: a hash of every file, as for the icons. `/img/game/*`
 * is cached for a year (`next.config.ts`), and the files are named by id, so
 * the version in the URL is what lets a regeneration reach a reader at once.
 */
const dir = path.join(OUT_DIR, "public/img/game/textures");
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
const hash = createHash("sha256");
for (const [name, bytes] of files) {
  writeFileSync(path.join(dir, name), bytes);
  hash.update(name);
  hash.update(bytes);
}
const version = hash.digest("hex").slice(0, 8);

mkdirSync(path.join(OUT_DIR, "lib/textures"), { recursive: true });
writeFileSync(
  path.join(OUT_DIR, "lib/textures/textures.json"),
  JSON.stringify({ version, textures: entries }) + "\n",
);

const bytes = files.reduce((total, [, file]) => total + file.length, 0);
console.log(
  `textures ${files.length} -> public/img/game/textures/<id>.png?v=${version} (${Math.round(bytes / 1024)} KB)`,
);
const unnamed = entries.filter((entry) => entry.name === "").map((entry) => entry.id);
if (unnamed.length > 0) console.log(`         no name for: ${unnamed.join(", ")}`);
console.log(`wrote    lib/textures/textures.json`);
