import { readFileSync } from "node:fs";

/**
 * Which equipment slots each object occupies, from the engine's *server*
 * object config (`data/pack/server/obj.dat`).
 *
 * The client never learns this: `wearpos`, `wearpos2` and `wearpos3` are
 * packed into the server's file only (`tools/pack/config/ObjConfig.ts`), and
 * the server uses them to build the appearance it sends. A full helm, for
 * one, has `wearpos2=head` and `wearpos3=jaw`, which is how the hair and the
 * beard disappear under it. The chathead has to make the same decision, so
 * the build reads the server's file for it.
 *
 * The file is a 2-byte count, then one opcode stream per object, each ended
 * by a 0. The engine's decoder (`src/cache/config/ObjType.ts`) reads the
 * client and the server streams with the same `decode`, so every opcode it
 * knows is listed here with its size, and one it does not is an error: that
 * means the pack is from a different engine than this reader, and guessing
 * past it would misread every object after it.
 */

export type WearPos = {
  wearpos: number;
  wearpos2: number;
  wearpos3: number;
};

class Reader {
  pos = 0;

  constructor(private readonly data: Buffer) {}

  get available(): number {
    return this.data.length - this.pos;
  }

  g1(): number {
    return this.data[this.pos++];
  }

  g2(): number {
    const value = this.data.readUInt16BE(this.pos);
    this.pos += 2;
    return value;
  }

  skip(bytes: number): void {
    this.pos += bytes;
  }

  /** A newline-terminated string, the engine's `gjstr`. */
  skipString(): void {
    const end = this.data.indexOf(10, this.pos);
    if (end === -1) throw new Error(`unterminated string at ${this.pos}`);
    this.pos = end + 1;
  }
}

/** Opcodes that carry a fixed number of bytes and nothing we need. */
const FIXED: ReadonlyMap<number, number> = new Map([
  [1, 2], // model
  [4, 2], // zoom2d
  [5, 2], // xan2d
  [6, 2], // yan2d
  [7, 2], // xof2d
  [8, 2], // yof2d
  [10, 2], // code10
  [11, 0], // stackable
  [12, 4], // cost
  [15, 0], // not tradeable
  [16, 0], // members
  [23, 3], // manwear + offset
  [24, 2], // manwear2
  [25, 3], // womanwear + offset
  [26, 2], // womanwear2
  [75, 2], // weight
  [78, 2], // manwear3
  [79, 2], // womanwear3
  [90, 2], // manhead
  [91, 2], // womanhead
  [92, 2], // manhead2
  [93, 2], // womanhead2
  [94, 2], // category
  [95, 2], // zan2d
  [96, 1], // dummyitem
  [97, 2], // certlink
  [98, 2], // certtemplate
  [110, 2], // resizex
  [111, 2], // resizey
  [112, 2], // resizez
  [113, 1], // ambient
  [114, 1], // contrast
  [201, 2], // respawnrate
]);

function decode(dat: Reader, id: number): WearPos {
  const out: WearPos = { wearpos: -1, wearpos2: -1, wearpos3: -1 };

  while (dat.available > 0) {
    const code = dat.g1();
    if (code === 0) return out;

    const fixed = FIXED.get(code);
    if (fixed !== undefined) {
      dat.skip(fixed);
    } else if (code === 13) {
      out.wearpos = dat.g1();
    } else if (code === 14) {
      out.wearpos2 = dat.g1();
    } else if (code === 27) {
      out.wearpos3 = dat.g1();
    } else if (code === 2 || code === 3 || code === 250) {
      dat.skipString(); // name, desc, debugname
    } else if (code >= 30 && code < 40) {
      dat.skipString(); // op, iop
    } else if (code === 40) {
      dat.skip(dat.g1() * 4); // recol_s + recol_d
    } else if (code >= 100 && code < 110) {
      dat.skip(4); // countobj + countco
    } else if (code === 249) {
      const count = dat.g1();
      for (let i = 0; i < count; i++) {
        dat.skip(3); // param id
        const isString = dat.g1() === 1;
        if (isString) dat.skipString();
        else dat.skip(4);
      }
    } else {
      throw new Error(
        `object ${id}: unknown config opcode ${code} in server/obj.dat; ` +
          `the pack is from an engine this reader does not match`,
      );
    }
  }
  return out;
}

export function readWearPos(file: string): WearPos[] {
  const dat = new Reader(readFileSync(file));
  const count = dat.g2();
  const out: WearPos[] = [];
  for (let id = 0; id < count; id++) out.push(decode(dat, id));
  return out;
}
