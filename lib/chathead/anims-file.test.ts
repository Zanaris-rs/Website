import { expect, it } from "vitest";

import { decodeAnims, encodeAnims } from "./anims-file";

it("round-trips", () => {
  const file = { frames: 4000, anims: [new Uint8Array([1, 2, 3]), new Uint8Array([9])] };
  const back = decodeAnims(encodeAnims(file));
  expect(back.frames).toBe(4000);
  expect(back.anims.map((a) => [...a])).toEqual([[1, 2, 3], [9]]);
});
