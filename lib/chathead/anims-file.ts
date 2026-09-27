import type { Client } from "./client.ts";

/**
 * `public/game/chathead/anims.bin`: the anim files the emotes' and the
 * moods' frames are in, cut down to those frames (`scripts/chathead/
 * stances.ts`), in the anim file's own layout. Big-endian:
 *
 *   u16 frames   anim frame ids in the cache (sizes the client's table)
 *   u8 count, then count x (u32 length, an anim file)
 */
export type AnimsFile = { frames: number; anims: Uint8Array[] };

export function encodeAnims(file: AnimsFile): Uint8Array {
  const size = 2 + 1 + file.anims.reduce((sum, anim) => sum + 4 + anim.length, 0);
  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  view.setUint16(0, file.frames);
  view.setUint8(2, file.anims.length);
  let at = 3;
  for (const anim of file.anims) {
    view.setUint32(at, anim.length);
    out.set(anim, at + 4);
    at += 4 + anim.length;
  }
  return out;
}

export function decodeAnims(bytes: Uint8Array): AnimsFile {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const frames = view.getUint16(0);
  const count = view.getUint8(2);
  const anims: Uint8Array[] = [];
  let at = 3;
  for (let i = 0; i < count; i++) {
    const length = view.getUint32(at);
    anims.push(bytes.subarray(at + 4, at + 4 + length));
    at += 4 + length;
  }
  if (at !== bytes.length) throw new Error("anims.bin: trailing bytes; the format has changed");
  return { frames, anims };
}

/** Each renderer's frame table, once made: `AnimFrame.init` empties it. */
const frameTables = new WeakMap<object, number>();

/**
 * Make a renderer's anim frame table, once. `bodies.bin` (the stances) and
 * `anims.bin` (the emotes and moods) both unpack into it, in either order:
 * whichever loads first makes it and the other only adds its frames, since
 * making it again would drop the first one's. Both carry the cache's frame
 * total, and the build checks they agree (`scripts/chathead/anims.ts`).
 */
export function initAnimFrames(client: Client, total: number): void {
  const made = frameTables.get(client.AnimFrame);
  if (made === undefined) {
    client.AnimFrame.init(total);
    frameTables.set(client.AnimFrame, total);
  } else if (made !== total) {
    throw new Error(`chathead: anim files from different caches (${made} and ${total} frames)`);
  }
}

/** Hand the emotes' and the moods' frames to the client. */
export function loadAnims(client: Client, file: AnimsFile): void {
  initAnimFrames(client, file.frames);
  for (const anim of file.anims) client.AnimFrame.unpack(anim);
}
