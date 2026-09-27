import { describe, expect, it, vi } from "vitest";

import { decodeAnims, encodeAnims, initAnimFrames, loadAnims } from "./anims-file";
import type { Client } from "./client";

it("round-trips", () => {
  const file = { frames: 4000, anims: [new Uint8Array([1, 2, 3]), new Uint8Array([9])] };
  const back = decodeAnims(encodeAnims(file));
  expect(back.frames).toBe(4000);
  expect(back.anims.map((a) => [...a])).toEqual([[1, 2, 3], [9]]);
});

describe("the anim frame table", () => {
  const fakeClient = () =>
    ({ AnimFrame: { init: vi.fn(), unpack: vi.fn() } }) as unknown as Client & {
      AnimFrame: { init: ReturnType<typeof vi.fn>; unpack: ReturnType<typeof vi.fn> };
    };

  it("is made once per renderer, whichever file loads first", () => {
    const client = fakeClient();
    // bodies.bin first (loadBodies makes it the same way), then anims.bin.
    initAnimFrames(client, 10100);
    loadAnims(client, { frames: 10100, anims: [new Uint8Array([1]), new Uint8Array([2])] });
    expect(client.AnimFrame.init).toHaveBeenCalledTimes(1);
    expect(client.AnimFrame.init).toHaveBeenCalledWith(10100);
    expect(client.AnimFrame.unpack).toHaveBeenCalledTimes(2);

    const other = fakeClient();
    loadAnims(other, { frames: 10100, anims: [] });
    initAnimFrames(other, 10100);
    expect(other.AnimFrame.init).toHaveBeenCalledTimes(1);
  });

  it("refuses files from caches of a different size", () => {
    const client = fakeClient();
    initAnimFrames(client, 10100);
    expect(() => initAnimFrames(client, 9000)).toThrow(/different caches/);
    expect(client.AnimFrame.init).toHaveBeenCalledTimes(1);
  });
});
