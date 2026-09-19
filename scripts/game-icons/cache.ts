import { readFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";

/**
 * A read-only view of the engine's `main_file_cache`: the `.dat` of 520-byte
 * sectors and one `.idx` per archive, the layout the engine writes in
 * `src/io/FileStream.ts`. Only reading is needed here, so this is that file's
 * `read` and nothing else.
 *
 * Each idx entry is 6 bytes: the file's size (3) and its first sector (3).
 * Each sector is an 8-byte header — file (2), part (2), next sector (3),
 * archive + 1 (1) — and up to 512 bytes of the file.
 */

const SECTOR = 520;
const HEADER = 8;
const CHUNK = SECTOR - HEADER;

export default class FileCache {
  private readonly dat: Buffer;
  private readonly idx: Buffer[];

  constructor(dir: string, archives: number) {
    this.dat = readFileSync(path.join(dir, "main_file_cache.dat"));
    this.idx = [];
    for (let i = 0; i < archives; i++) {
      this.idx.push(readFileSync(path.join(dir, `main_file_cache.idx${i}`)));
    }
  }

  count(archive: number): number {
    return Math.floor(this.idx[archive].length / 6);
  }

  /** The stored bytes of one file, or `null` for an empty slot. */
  read(archive: number, file: number): Buffer | null {
    const idx = this.idx[archive];
    if (file < 0 || file >= this.count(archive)) return null;

    const size = idx.readUIntBE(file * 6, 3);
    let sector = idx.readUIntBE(file * 6 + 3, 3);
    if (size === 0 || sector === 0) return null;

    const out = Buffer.alloc(size);
    let written = 0;
    for (let part = 0; written < size; part++) {
      const at = sector * SECTOR;
      if (at + HEADER > this.dat.length) {
        throw new Error(
          `archive ${archive} file ${file}: sector ${sector} is past the end`,
        );
      }

      const sectorFile = this.dat.readUInt16BE(at);
      const sectorPart = this.dat.readUInt16BE(at + 2);
      const next = this.dat.readUIntBE(at + 4, 3);
      const sectorArchive = this.dat[at + 7] - 1;
      if (
        sectorFile !== file ||
        sectorPart !== part ||
        sectorArchive !== archive
      ) {
        throw new Error(
          `archive ${archive} file ${file}: sector ${sector} belongs to another file`,
        );
      }

      const n = Math.min(CHUNK, size - written);
      this.dat.copy(out, written, at + HEADER, at + HEADER + n);
      written += n;
      sector = next;
    }
    return out;
  }

  /**
   * An on-demand file (models, anims, midis, maps): gzip, followed by the
   * 2-byte version the engine's `FileStream.write` appends.
   */
  readGzip(archive: number, file: number): Buffer | null {
    const stored = this.read(archive, file);
    if (!stored) return null;
    return gunzipSync(stored.subarray(0, stored.length - 2));
  }
}
