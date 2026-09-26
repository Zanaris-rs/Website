import "../chathead/browser-stub.ts";

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import opentype from "opentype.js";

/**
 * The game's b12 and p12 fonts as TrueType, drawn from the client's own
 * PixFont.depack out of the pack's `title` archive - so every glyph is the
 * game's pixels, as square contours, and every advance is the client's.
 *
 * One game pixel is PIXEL units and the em is the font's height in pixels,
 * so `font-size: <height>px` draws one game pixel per CSS pixel (and any
 * whole multiple stays crisp). The baseline is where PixFont's `y` is: a
 * glyph's top row sits `height - offsetY` pixels above it.
 *
 *   public/game/fonts/<font>.ttf     the fonts
 *   lib/game-chat/metrics.json       heights, advances, and sample widths
 *                                    measured with PixFont.stringWid, which
 *                                    metrics.test.ts holds lib/game-chat to
 */

const PIXEL = 64;
const CLIENT_DIR = required("CLIENT_DIR");
const ENGINE_DIR = required("ENGINE_DIR");
const OUT_DIR = required("OUT_DIR");

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return path.resolve(value);
}

const client = async <T>(file: string): Promise<T> =>
  (await import(path.join(CLIENT_DIR, "src", file))).default as T;

type PixFontT = {
  charMask: Int8Array[];
  charMaskWidth: Int32Array;
  charMaskHeight: Int32Array;
  charOffsetX: Int32Array;
  charOffsetY: Int32Array;
  charAdvance: Int32Array;
  height: number;
  stringWid(text: string): number;
};
const JagFile = await client<{ new (data: Uint8Array): { read(name: string): Uint8Array | null } }>("io/JagFile.ts");
const PixFont = await client<{ depack(archive: unknown, name: string, quill: boolean): PixFontT }>("graphics/PixFont.ts");

const title = new JagFile(new Uint8Array(readFileSync(path.join(ENGINE_DIR, "data/pack/client/title"))));

const SAMPLES = [
  "Selling lobbies 250ea",
  "Welcome to my log, traveller!",
  "Click here to continue",
  "The quick brown fox jumps over the lazy dog 0123456789",
  "!\"£$%^&*()-=_+[]{};'#:@~,./<>?",
];

/** A glyph's lit pixels as rectangles: row runs, merged down while they match. */
function rectangles(font: PixFontT, c: number): { x: number; y: number; w: number; h: number }[] {
  const w = font.charMaskWidth[c];
  const h = font.charMaskHeight[c];
  const mask = font.charMask[c];
  const open = new Map<string, { x: number; y: number; w: number; h: number }>();
  const done: { x: number; y: number; w: number; h: number }[] = [];
  for (let y = 0; y < h; y++) {
    const runs: [number, number][] = [];
    for (let x = 0; x < w; ) {
      if (mask[x + y * w] === 0) { x++; continue; }
      const start = x;
      while (x < w && mask[x + y * w] !== 0) x++;
      runs.push([start, x - start]);
    }
    const next = new Map<string, { x: number; y: number; w: number; h: number }>();
    for (const [x, length] of runs) {
      const key = `${x}:${length}`;
      const rect = open.get(key);
      if (rect) { rect.h++; next.set(key, rect); open.delete(key); }
      else next.set(key, { x, y, w: length, h: 1 });
    }
    done.push(...open.values());
    open.clear();
    for (const [key, rect] of next) open.set(key, rect);
  }
  done.push(...open.values());
  return done;
}

function build(name: "b12" | "p12") {
  const font = PixFont.depack(title, `${name}_full`, false);
  const glyphs = [new opentype.Glyph({ name: ".notdef", unicode: 0, advanceWidth: 8 * PIXEL, path: new opentype.Path() })];
  let below = 0;
  for (let c = 32; c < 256; c++) {
    const advance = font.charAdvance[c];
    if (!advance && c !== 32) continue;
    const glyphPath = new opentype.Path();
    const top = font.height - font.charOffsetY[c]; // pixels above the baseline
    below = Math.max(below, font.charOffsetY[c] + font.charMaskHeight[c] - font.height);
    for (const r of rectangles(font, c)) {
      const x0 = (font.charOffsetX[c] + r.x) * PIXEL;
      const x1 = x0 + r.w * PIXEL;
      const y0 = (top - r.y) * PIXEL; // top edge, y up
      const y1 = y0 - r.h * PIXEL;
      // clockwise, TrueType's outside
      glyphPath.moveTo(x0, y0);
      glyphPath.lineTo(x1, y0);
      glyphPath.lineTo(x1, y1);
      glyphPath.lineTo(x0, y1);
      glyphPath.close();
    }
    glyphs.push(new opentype.Glyph({ name: `c${c}`, unicode: c, advanceWidth: advance * PIXEL, path: glyphPath }));
  }
  const otf = new opentype.Font({
    familyName: `Zanaris ${name}`,
    styleName: "Regular",
    unitsPerEm: font.height * PIXEL,
    ascender: font.height * PIXEL,
    descender: -Math.max(below, 1) * PIXEL,
    glyphs,
  });
  const bytes = new Uint8Array(otf.toArrayBuffer());
  const advance = Array.from({ length: 256 }, (_, c) => font.charAdvance[c]);
  const samples = Object.fromEntries(SAMPLES.map((text) => [text, font.stringWid(text)]));
  return { bytes, metrics: { height: font.height, advance, samples } };
}

const b12 = build("b12");
const p12 = build("p12");
const version = createHash("sha256").update(b12.bytes).update(p12.bytes).digest("hex").slice(0, 12);

mkdirSync(path.join(OUT_DIR, "public/game/fonts"), { recursive: true });
writeFileSync(path.join(OUT_DIR, "public/game/fonts/b12.ttf"), b12.bytes);
writeFileSync(path.join(OUT_DIR, "public/game/fonts/p12.ttf"), p12.bytes);
writeFileSync(
  path.join(OUT_DIR, "lib/game-chat/metrics.json"),
  JSON.stringify({ version, fonts: { b12: b12.metrics, p12: p12.metrics } }) + "\n",
);
console.log(`fonts    b12 ${b12.bytes.length} bytes, p12 ${p12.bytes.length} bytes -> public/game/fonts/*.ttf?v=${version}`);
