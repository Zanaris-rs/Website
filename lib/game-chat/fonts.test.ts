import { readFileSync } from "node:fs";
import path from "node:path";

import opentype from "opentype.js";
import { describe, expect, it } from "vitest";

import { FONT_METRICS, type GameFont } from "./metrics";

/**
 * The client's PixFont never draws glyph 32 (space): `PixFont.drawString`
 * and `centreStringWave` in Client-TS's graphics/PixFont.ts both guard with
 * `if (c !== 32)` / `if (c != 32)`, and only ever advance the cursor by
 * `charAdvance[32]`. The generated fonts must match that: an empty outline
 * for the space, but its full advance width - or a space renders as a dot.
 */

const PUBLIC_FONTS = path.join(__dirname, "../../public/game/fonts");
const PIXEL = 64;

function loadFont(font: GameFont): opentype.Font {
  const data = readFileSync(path.join(PUBLIC_FONTS, `${font}.ttf`));
  return opentype.parse(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
}

describe.each(["b12", "p12"] as GameFont[])("%s font", (font) => {
  const otf = loadFont(font);

  it("has no outline for the space, only its advance width", () => {
    const glyph = otf.charToGlyph(" ");
    expect(glyph.path.commands).toHaveLength(0);
    expect(glyph.advanceWidth).toBe(FONT_METRICS.fonts[font].advance[32] * PIXEL);
  });

  it("still draws a visible glyph", () => {
    const glyph = otf.charToGlyph("A");
    expect(glyph.path.commands.length).toBeGreaterThan(0);
  });
});
