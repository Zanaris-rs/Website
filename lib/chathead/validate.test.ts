import { describe, expect, it } from "vitest";

import type { Look } from "./look";
import {
  checkLook,
  checkOutfit,
  defaultLook,
  kitChoices,
  OUTFIT_NAME_MAX,
} from "./validate";

const MALE: Look = {
  gender: 0,
  kits: [0, 10, 18, 26, 33, 36, 42],
  colours: [0, 0, 0, 0, 0],
  worn: new Array(14).fill(-1),
};

function wearing(slot: number, obj: number, look: Look = MALE): Look {
  const worn = [...look.worn];
  worn[slot] = obj;
  return { ...look, worn };
}

describe("checkLook", () => {
  it("accepts the engine's new-player look and both design defaults", () => {
    expect(checkLook(MALE)).toBeNull();
    expect(checkLook(defaultLook(0))).toBeNull();
    expect(checkLook(defaultLook(1))).toBeNull();
  });

  it("lets anyone wear anything, in its own slot", () => {
    expect(checkLook(wearing(0, 1038))).toBeNull(); // red partyhat
    expect(checkLook(wearing(4, 1127))).toBeNull(); // rune platebody
    expect(checkLook(wearing(0, 1127))).toMatch(/not worn in slot 0/);
    expect(checkLook(wearing(0, 995))).toMatch(/not worn/); // coins
  });

  it("holds kits to the design screen's rules", () => {
    // A disabled kit (9 is the male hair the design screen skips).
    expect(checkLook({ ...MALE, kits: [9, 10, 18, 26, 33, 36, 42] })).toMatch(
      /kit 9/,
    );
    // A female kit on a man.
    expect(checkLook({ ...MALE, kits: [45, 10, 18, 26, 33, 36, 42] })).toMatch(
      /kit 45/,
    );
    // A hair kit in the jaw.
    expect(checkLook({ ...MALE, kits: [0, 0, 18, 26, 33, 36, 42] })).toMatch(
      /part 1/,
    );
  });

  it("lets a woman, and only a woman, go without a jaw", () => {
    const woman = defaultLook(1);
    expect(woman.kits[1]).toBe(-1);
    expect(checkLook(woman)).toBeNull();
    expect(checkLook({ ...MALE, kits: [0, -1, 18, 26, 33, 36, 42] })).toMatch(
      /kit -1/,
    );
  });

  it("keeps colours inside their palettes", () => {
    expect(checkLook({ ...MALE, colours: [11, 15, 15, 5, 7] })).toBeNull();
    expect(checkLook({ ...MALE, colours: [12, 0, 0, 0, 0] })).toMatch(
      /palette 0/,
    );
    expect(checkLook({ ...MALE, colours: [0, 0, 0, 0, -1] })).toMatch(
      /palette 4/,
    );
  });

  it("refuses shapes that are not a look", () => {
    expect(checkLook(null)).toMatch(/missing/);
    expect(checkLook({ ...MALE, gender: 2 })).toMatch(/gender/);
    expect(checkLook({ ...MALE, kits: [0, 10] })).toMatch(/7/);
    expect(checkLook({ ...MALE, worn: [] })).toMatch(/14/);
    expect(checkLook({ ...MALE, colours: [0.5, 0, 0, 0, 0] })).toMatch(/5/);
  });
});

describe("checkOutfit", () => {
  it("trims the name and copies the look", () => {
    const result = checkOutfit({ name: "  Party time ", look: MALE });
    expect(result).toEqual({
      ok: true,
      outfit: { name: "Party time", look: MALE },
    });
  });

  it("refuses an empty, long or control-character name", () => {
    expect(checkOutfit({ name: "  ", look: MALE }).ok).toBe(false);
    expect(
      checkOutfit({ name: "x".repeat(OUTFIT_NAME_MAX + 1), look: MALE }).ok,
    ).toBe(false);
    expect(checkOutfit({ name: "a\u0007b", look: MALE }).ok).toBe(false);
  });
});

describe("kitChoices", () => {
  it("offers only selectable kits of that part and gender", () => {
    const hair = kitChoices(0, 0);
    expect(hair).toContain(0);
    expect(hair).not.toContain(9);
    expect(kitChoices(1, 1)).toEqual([]); // women have no jaw kits to choose
  });
});
