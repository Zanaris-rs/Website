import type { Client } from "./client.ts";

/**
 * `public/game/chathead/models.bin`: the handful of models a chathead can be
 * made of — every kit's and every hat's head models, about a hundred KB —
 * out of the thousands in the game cache.
 *
 * Each model is the cache's own bytes after gunzip, which is the format the
 * client's `Model.unpack` takes, so nothing is converted. The layout is
 * big-endian:
 *
 *   u16 total   model slots in the cache (sizes the client's table)
 *   u16 count   models in this file
 *   count x (u16 id, u32 length)
 *   the models' bytes, in the same order
 */

export type ModelFile = { total: number; models: Map<number, Uint8Array> };

export function encodeModels(file: ModelFile): Uint8Array {
  const entries = [...file.models].sort(([a], [b]) => a - b);
  const header = 4 + entries.length * 6;
  const size = entries.reduce((sum, [, bytes]) => sum + bytes.length, header);

  const out = new Uint8Array(size);
  const view = new DataView(out.buffer);
  view.setUint16(0, file.total);
  view.setUint16(2, entries.length);

  let at = header;
  entries.forEach(([id, bytes], i) => {
    view.setUint16(4 + i * 6, id);
    view.setUint32(4 + i * 6 + 2, bytes.length);
    out.set(bytes, at);
    at += bytes.length;
  });
  return out;
}

export function decodeModels(bytes: Uint8Array): ModelFile {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const total = view.getUint16(0);
  const count = view.getUint16(2);

  const models = new Map<number, Uint8Array>();
  let at = 4 + count * 6;
  for (let i = 0; i < count; i++) {
    const id = view.getUint16(4 + i * 6);
    const length = view.getUint32(4 + i * 6 + 2);
    if (at + length > bytes.length) {
      throw new Error(`models.bin: model ${id} runs past the end of the file`);
    }
    models.set(id, bytes.subarray(at, at + length));
    at += length;
  }
  return { total, models };
}

/**
 * Hand the models to the client. Any other model is absent, and the client
 * asking for one is a bug in the build (a head part it did not export), so
 * it throws rather than drawing a head with a piece missing.
 */
export function loadModels(client: Client, file: ModelFile): void {
  client.Model.init(file.total, {
    requestModel(id: number) {
      throw new Error(`chathead: model ${id} is not in models.bin`);
    },
  });
  for (const [id, bytes] of file.models) client.Model.unpack(id, bytes);
}
