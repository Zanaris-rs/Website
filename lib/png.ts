import { deflateSync } from "node:zlib";

/**
 * A PNG encoder for one kind of picture: 8-bit RGBA, unfiltered, in a single
 * IDAT. It is what a server-drawn chathead needs to become an `<img>` in a
 * link preview (`lib/chathead/server.ts`), and it is a few dozen lines, so
 * the site does not take on an image library for it.
 *
 * Unfiltered costs some compression, which does not matter at this size: the
 * pictures are a few hundred pixels a side and mostly transparent, and they
 * are drawn into a larger image rather than sent as they are.
 *
 * The layout is the spec's (https://www.w3.org/TR/png/): the signature, then
 * chunks of `u32 length, 4-byte type, data, u32 CRC`, all big-endian, where
 * the CRC covers the type and the data.
 */

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Bit depth 8, colour type 6 (truecolour with alpha): four bytes a pixel. */
const BIT_DEPTH = 8;
const COLOUR_RGBA = 6;
/** Filter type 0 (None), written before every row. */
const FILTER_NONE = 0;

/** The CRC-32 table (polynomial 0xEDB88320), as in the spec's sample code. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 of some bytes: what a PNG chunk carries over its type and data. */
export function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "latin1");
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/**
 * Encode `width * height` RGBA pixels, row by row from the top left, as a
 * PNG. Alpha is straight (not premultiplied), as a canvas's `ImageData` is.
 */
export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error(`png: bad size ${width}x${height}`);
  }
  const stride = width * 4;
  if (rgba.length !== stride * height) {
    throw new Error(`png: ${rgba.length} bytes for a ${width}x${height} RGBA image`);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = BIT_DEPTH;
  header[9] = COLOUR_RGBA;
  // Compression 0 (deflate), filter method 0, interlace 0 (none).

  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = FILTER_NONE;
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array(0)),
  ]);
}
