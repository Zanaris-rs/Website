import { inflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { crc32, encodePng } from "./png";

/**
 * The encoder is checked against the PNG spec byte by byte rather than by
 * decoding with a library: the site has no PNG decoder, and the point of
 * `png.ts` is to not need one.
 */

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

type Chunk = { type: string; data: Buffer; crc: number; crcInput: Buffer };

/** Split a PNG after its signature into its chunks. */
function chunks(png: Buffer): Chunk[] {
  const found: Chunk[] = [];
  let at = SIGNATURE.length;
  while (at < png.length) {
    const length = png.readUInt32BE(at);
    const type = png.toString("latin1", at + 4, at + 8);
    const data = png.subarray(at + 8, at + 8 + length);
    const crc = png.readUInt32BE(at + 8 + length);
    found.push({ type, data, crc, crcInput: png.subarray(at + 4, at + 8 + length) });
    at += 12 + length;
  }
  return found;
}

// Two pixels: an opaque orange and a half-transparent blue.
const PIXELS = new Uint8Array([0xff, 0xb0, 0x00, 0xff, 0x10, 0x20, 0xc0, 0x80]);

describe("encodePng", () => {
  const png = encodePng(2, 1, PIXELS);

  it("starts with the PNG signature", () => {
    expect([...png.subarray(0, 8)]).toEqual(SIGNATURE);
  });

  it("is IHDR, one IDAT and IEND, in that order", () => {
    expect(chunks(png).map((chunk) => chunk.type)).toEqual(["IHDR", "IDAT", "IEND"]);
  });

  it("describes a 2x1, 8-bit RGBA image in IHDR", () => {
    const ihdr = chunks(png)[0].data;
    expect(ihdr.length).toBe(13);
    expect(ihdr.readUInt32BE(0)).toBe(2); // width
    expect(ihdr.readUInt32BE(4)).toBe(1); // height
    expect(ihdr[8]).toBe(8); // bit depth
    expect(ihdr[9]).toBe(6); // colour type: truecolour with alpha
    expect([ihdr[10], ihdr[11], ihdr[12]]).toEqual([0, 0, 0]); // deflate, filter 0, no interlace
  });

  it("stores each row behind filter byte 0", () => {
    const idat = chunks(png)[1].data;
    expect([...inflateSync(idat)]).toEqual([0, ...PIXELS]);
  });

  it("gives every chunk the CRC of its type and data", () => {
    for (const chunk of chunks(png)) {
      expect(chunk.crc, chunk.type).toBe(crc32(chunk.crcInput));
    }
  });

  it("puts an empty IEND at the end", () => {
    const iend = chunks(png)[2];
    expect(iend.data.length).toBe(0);
    // Every PNG ends with the same twelve bytes.
    expect([...png.subarray(-12)]).toEqual([
      0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
  });

  it("refuses pixels that do not fill the image", () => {
    expect(() => encodePng(2, 2, PIXELS)).toThrow();
  });
});

describe("crc32", () => {
  it("matches the standard check value", () => {
    // CRC-32/ISO-HDLC of "123456789".
    expect(crc32(Buffer.from("123456789", "latin1"))).toBe(0xcbf43926);
  });
});
