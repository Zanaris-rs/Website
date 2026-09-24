import { describe, expect, it } from "vitest";

import type { HeadTables } from "./head";
import heads from "./heads.json";
import { KIT, type Look, lookKey, OBJ, toAppearance } from "./look";

const tables = heads as HeadTables;

/**
 * `toAppearance` is the one piece of the chathead the golden test cannot
 * vouch for: the reference pictures are built from its output too. So its
 * rules are checked here against the engine's `Player.generateAppearance`,
 * slot by slot.
 */

// The engine's new-player look (`Player.body`) and nothing worn.
const MALE: Look = {
  gender: 0,
  kits: [0, 10, 18, 26, 33, 36, 42],
  colours: [0, 0, 0, 0, 0],
  worn: new Array(14).fill(-1),
};

function wearing(look: Look, slot: number, obj: number): Look {
  const worn = [...look.worn];
  worn[slot] = obj;
  return { ...look, worn };
}

// Slots (`equip.constant`): 0 hat, 3 weapon, 4 torso, 8 hair, 11 jaw.
const FULL_HELM = 1163; // rune full helm: wearpos2=head, wearpos3=jaw
const PARTY_HAT = 1038;

describe("toAppearance", () => {
  it("puts each kit in the slot the engine does", () => {
    expect(toAppearance(MALE, {})).toEqual([
      0, 0, 0, 0,
      KIT + 18, // torso
      0,
      KIT + 26, // arms
      KIT + 36, // legs
      KIT + 0, // hair
      KIT + 33, // hands
      KIT + 42, // feet
      KIT + 10, // jaw
    ]);
  });

  it("leaves a slot with no kit empty", () => {
    const bald = { ...MALE, kits: [-1, -1, 18, 26, 33, 36, 42] };
    const appearance = toAppearance(bald, {});
    expect(appearance[8]).toBe(0);
    expect(appearance[11]).toBe(0);
  });

  it("lets a worn object win its slot over the kit", () => {
    const appearance = toAppearance(wearing(MALE, 4, 1127), {});
    expect(appearance[4]).toBe(OBJ + 1127);
  });

  it("empties the slots a worn object's wearpos2 and wearpos3 name", () => {
    const appearance = toAppearance(
      wearing(MALE, 0, FULL_HELM),
      tables.hides,
    );
    expect(appearance[0]).toBe(OBJ + FULL_HELM);
    expect(appearance[8]).toBe(0);
    expect(appearance[11]).toBe(0);
  });

  it("keeps the hair and beard under a hat that hides nothing", () => {
    expect(tables.hides[PARTY_HAT]).toBeUndefined();
    const appearance = toAppearance(
      wearing(MALE, 0, PARTY_HAT),
      tables.hides,
    );
    expect(appearance[8]).toBe(KIT + 0);
    expect(appearance[11]).toBe(KIT + 10);
  });

  it("ignores the ring and ammo slots, which the model never shows", () => {
    const appearance = toAppearance(wearing(MALE, 12, 1635), {});
    expect(appearance).toHaveLength(12);
    expect(appearance).not.toContain(OBJ + 1635);
  });
});

describe("the exported tables", () => {
  it("say a full helm hides the hair and jaw", () => {
    expect([...tables.hides[FULL_HELM]].sort()).toEqual([11, 8]);
  });
});

describe("lookKey", () => {
  it("tells apart looks that differ in any part", () => {
    const keys = new Set([
      lookKey(MALE),
      lookKey({ ...MALE, gender: 1 }),
      lookKey({ ...MALE, colours: [1, 0, 0, 0, 0] }),
      lookKey(wearing(MALE, 0, PARTY_HAT)),
    ]);
    expect(keys.size).toBe(4);
  });
});
