/**
 * Anim files, cut down to the frames a figure stands in.
 *
 * A figure is posed with the first frame of the player's stance
 * (`human_ready`, or a weapon's own). Each frame lives in an anim file of a
 * few hundred frames that share one skeleton (`AnimBase`) — the stances are
 * in two files of about 40 KB — so the build keeps the skeleton and the
 * frames it needs and drops the rest, in the file's own layout, which the
 * client's `AnimFrame.unpack` then reads as it reads any anim file.
 *
 * The layout (`AnimFrame.unpack`): five sections back to back, then their
 * lengths as the file's last eight bytes.
 *
 *   head   u16 frame count, then per frame: u16 id, u8 group count
 *   tran1  per frame, per group: u8 flags (bit 0 x, bit 1 y, bit 2 z)
 *   tran2  per flag set: one value, 1 byte if the first is below 0x80, else 2
 *   del    per frame: u8 delay
 *   base   the skeleton, to the trailer
 *   u16 head length (less the count), u16 tran1, u16 tran2, u16 del
 */

type Section = { start: number; end: number };

function sections(data: Uint8Array) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const trailer = data.length - 8;
  const headLength = view.getUint16(trailer);
  const tran1Length = view.getUint16(trailer + 2);
  const tran2Length = view.getUint16(trailer + 4);
  const delLength = view.getUint16(trailer + 6);

  let at = 0;
  const take = (length: number): Section => {
    const section = { start: at, end: at + length };
    at += length;
    return section;
  };
  const head = take(headLength + 2);
  const tran1 = take(tran1Length);
  const tran2 = take(tran2Length);
  const del = take(delLength);
  const base = take(trailer - at);
  return { view, head, tran1, tran2, del, base };
}

/** Every frame in an anim file, in the file's order. */
export function framesIn(data: Uint8Array): number[] {
  const { view, head } = sections(data);
  const count = view.getUint16(head.start);
  const ids: number[] = [];
  for (let i = 0; i < count; i++) ids.push(view.getUint16(head.start + 2 + i * 3));
  return ids;
}

/** The anim file with only the frames in `keep`, and its skeleton. */
export function cutAnim(data: Uint8Array, keep: ReadonlySet<number>): Uint8Array {
  const { view, head, tran1, tran2, del, base } = sections(data);
  const out = { head: [] as number[], tran1: [] as number[], tran2: [] as number[], del: [] as number[] };

  const count = view.getUint16(head.start);
  let h = head.start + 2;
  let t1 = tran1.start;
  let t2 = tran2.start;
  let d = del.start;
  let kept = 0;
  for (let i = 0; i < count; i++) {
    const id = view.getUint16(h);
    const groups = data[h + 2];
    h += 3;
    const wanted = keep.has(id);

    const tran1Start = t1;
    const tran2Start = t2;
    for (let group = 0; group < groups; group++) {
      const flags = data[t1++];
      for (const bit of [1, 2, 4]) {
        if ((flags & bit) !== 0) t2 += data[t2] < 0x80 ? 1 : 2;
      }
    }

    if (wanted) {
      kept++;
      out.head.push(id >> 8, id & 0xff, groups);
      out.tran1.push(...data.subarray(tran1Start, t1));
      out.tran2.push(...data.subarray(tran2Start, t2));
      out.del.push(data[d]);
    }
    d++;
  }
  if (t1 !== tran1.end || t2 !== tran2.end || d !== del.end) {
    throw new Error("an anim file's sections do not add up; the layout has changed");
  }
  if (kept !== keep.size) {
    throw new Error(`an anim file holds ${kept} of the ${keep.size} frames asked for`);
  }

  const skeleton = data.subarray(base.start, base.end);
  const size =
    2 + out.head.length + out.tran1.length + out.tran2.length + out.del.length +
    skeleton.length + 8;
  const file = new Uint8Array(size);
  const fileView = new DataView(file.buffer);
  let at = 0;
  fileView.setUint16(at, kept);
  at += 2;
  for (const part of [out.head, out.tran1, out.tran2, out.del]) {
    file.set(part, at);
    at += part.length;
  }
  file.set(skeleton, at);
  at += skeleton.length;
  fileView.setUint16(at, out.head.length);
  fileView.setUint16(at + 2, out.tran1.length);
  fileView.setUint16(at + 4, out.tran2.length);
  fileView.setUint16(at + 6, out.del.length);
  return file;
}
