import { initAnimFrames } from "./anims-file.ts";
import { type Client, prepare } from "./client.ts";
import { decodeModels, encodeModels, loadModels, type ModelFile } from "./models.ts";

/**
 * `public/game/chathead/bodies.bin`: everything a figure is drawn from that
 * is not a table — out of the 38 MB cache, the few hundred models a body can
 * be made of, the handful of textures they use, and the frames of the
 * stances players stand in.
 *
 * Every part is the cache's own bytes, in the format the client's own
 * reader takes, so nothing is converted: the models as in `models.bin`; the
 * texture files as the textures archive names them (`index.dat`,
 * `<id>.dat`); and anim files cut down to the frames used, in the anim
 * file's own layout (see `scripts/chathead/stances.ts`). Big-endian:
 *
 *   u32 length, then the models (the models.bin format)
 *   u16 frames   anim frame ids in the cache (sizes the client's table)
 *   u8 count, then count x (u32 length, an anim file)
 *   u8 count, then count x (u8 name length, the name, u32 length, the file)
 */

export type BodiesFile = {
  models: ModelFile;
  frames: number;
  anims: Uint8Array[];
  textures: Map<string, Uint8Array>;
};

export function encodeBodies(file: BodiesFile): Uint8Array {
  const models = encodeModels(file.models);
  const names = [...file.textures.keys()].sort();
  const size =
    4 + models.length +
    2 +
    1 + file.anims.reduce((sum, anim) => sum + 4 + anim.length, 0) +
    1 + names.reduce((sum, name) => sum + 1 + name.length + 4 + file.textures.get(name)!.length, 0);

  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  let at = 0;
  const bytes = (data: Uint8Array) => {
    view.setUint32(at, data.length);
    out.set(data, at + 4);
    at += 4 + data.length;
  };

  bytes(models);
  view.setUint16(at, file.frames);
  at += 2;
  view.setUint8(at++, file.anims.length);
  file.anims.forEach(bytes);
  view.setUint8(at++, names.length);
  for (const name of names) {
    view.setUint8(at++, name.length);
    for (let i = 0; i < name.length; i++) out[at++] = name.charCodeAt(i);
    bytes(file.textures.get(name)!);
  }
  return out;
}

export function decodeBodies(data: Uint8Array): BodiesFile {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let at = 0;
  const bytes = () => {
    const length = view.getUint32(at);
    if (at + 4 + length > data.length) {
      throw new Error("bodies.bin: a part runs past the end of the file");
    }
    const part = data.subarray(at + 4, at + 4 + length);
    at += 4 + length;
    return part;
  };

  const models = decodeModels(bytes());
  const frames = view.getUint16(at);
  at += 2;
  const anims: Uint8Array[] = [];
  for (let n = view.getUint8(at++); n > 0; n--) anims.push(bytes());
  const textures = new Map<string, Uint8Array>();
  for (let n = view.getUint8(at++); n > 0; n--) {
    const length = view.getUint8(at++);
    const name = String.fromCharCode(...data.subarray(at, at + length));
    at += length;
    textures.set(name, bytes());
  }
  return { models, frames, anims, textures };
}

/**
 * Hand a figure's files to the client, in the client's start-up order
 * (`Client.ts`, "Unpacking textures" onwards): the textures first, then the
 * colour table, which holds their palettes, and room to expand them; then
 * the models and the stance frames.
 *
 * The renderer may already be drawing chatheads, or hold the emotes' and
 * moods' frames (`anims.bin`); none of this changes either. The frame table
 * is made once for both files (`initAnimFrames`).
 */
export function loadBodies(client: Client, file: BodiesFile): void {
  client.Pix3D.unpackTextures({
    read: (name) => file.textures.get(name) ?? null,
  });
  prepare(client);
  client.Pix3D.initPool(20);

  loadModels(client, file.models);
  initAnimFrames(client, file.frames);
  for (const anim of file.anims) client.AnimFrame.unpack(anim);
}
