import { describe, expect, it } from "vitest";

import { wardrobeOf } from "./wardrobe";

const LOOK = {
  gender: 0,
  kits: [0, 10, 18, 26, 33, 36, 42],
  colours: [0, 0, 0, 0, 0],
  worn: new Array(14).fill(-1),
};

describe("wardrobeOf", () => {
  it("lists every saved outfit in slot order and marks the picture", () => {
    const outfits = new Array(10).fill(null);
    outfits[7] = { name: "Party", look: LOOK };
    outfits[2] = { name: "Rune", look: LOOK };
    expect(wardrobeOf({ outfits, defaultSlot: 7 })).toEqual([
      { slot: 2, name: "Rune", look: LOOK, isDefault: false },
      { slot: 7, name: "Party", look: LOOK, isDefault: true },
    ]);
  });

  it("is empty for a player with no outfits", () => {
    expect(wardrobeOf({ outfits: new Array(10).fill(null), defaultSlot: null })).toEqual([]);
  });
});
