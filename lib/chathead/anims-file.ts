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
