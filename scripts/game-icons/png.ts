import { deflateSync } from "node:zlib";

/**
 * The smallest PNG writer that does the job: 8-bit RGBA, no filtering, one
 * IDAT. It exists so the icon generator needs no image library, and so the
 * same pixels always produce the same bytes — re-running the generator on an
 * unchanged cache must leave `git status` clean.
 */

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
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
 * Encode client pixels as a PNG. The client's rule, kept as is: `0` is
 * transparent and anything else is an opaque `0xRRGGBB` — which is why the
 * client itself nudges true black to `1` wherever it means black.
 */
export function encodePng(
  pixels: Int32Array,
  width: number,
  height: number,
): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA

  const stride = 1 + width * 4;
  const raw = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    // raw[y * stride] stays 0: filter type None
    for (let x = 0; x < width; x++) {
      const rgb = pixels[x + y * width];
      if (rgb === 0) continue;
      const at = y * stride + 1 + x * 4;
      raw[at] = (rgb >> 16) & 0xff;
      raw[at + 1] = (rgb >> 8) & 0xff;
      raw[at + 2] = rgb & 0xff;
      raw[at + 3] = 0xff;
    }
  }

  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", new Uint8Array(0)),
  ]);
}
