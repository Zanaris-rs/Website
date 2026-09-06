import { describe, expect, it } from "vitest";

import table from "./names.json";
import { itemName } from "./names";

const NAMES: Record<string, string> = table;

/**
 * The generated table is data, not code, so these tests are about the *shape*
 * a regeneration must keep rather than about every one of its 3883 rows: the
 * items the tracked list on /economy names, the two rules that are easy to
 * break when the generator is edited (notes are marked, shared names are
 * qualified), and the promise that no id is ever printed on its own.
 */

describe("itemName", () => {
  it("names coins", () => {
    // 995 everywhere in the engine, and the one id the census counts on its own.
    expect(itemName(995)).toBe("Coins");
  });

  it("names every item /economy tracks", () => {
    // The list in the engine's `data/config/economy.json`, by id: the six
    // partyhats, the three hallowe'en masks, the santa hat, the disk of
    // returning, the half full wine jug, the christmas cracker, the pumpkin
    // and the easter egg.
    const tracked: [number, string][] = [
      [1038, "Red partyhat"],
      [1040, "Yellow partyhat"],
      [1042, "Blue partyhat"],
      [1044, "Green partyhat"],
      [1046, "Purple partyhat"],
      [1048, "White partyhat"],
      [1050, "Santa hat"],
      [1053, "Halloween mask (green)"],
      [1055, "Halloween mask (blue)"],
      [1057, "Halloween mask (red)"],
      [981, "Disk of returning"],
      [1989, "Half full wine jug"],
      [962, "Christmas cracker"],
      [1959, "Pumpkin"],
      [1961, "Easter egg"],
    ];

    for (const [id, name] of tracked) {
      expect(itemName(id)).toBe(name);
    }
  });

  it("tells the three hallowe'en masks apart, which the game does not", () => {
    expect(itemName(1053)).toBe("Halloween mask (green)");
    expect(itemName(1055)).toBe("Halloween mask (blue)");
    expect(itemName(1057)).toBe("Halloween mask (red)");
  });

  it("marks a note, and keeps its qualifier in the same bracket", () => {
    expect(itemName(1051)).toBe("Santa hat (noted)");
    expect(itemName(839)).toBe("Longbow");
    expect(itemName(48)).toBe("Longbow (unstrung)");
    expect(itemName(49)).toBe("Longbow (unstrung, noted)");
  });

  it("leaves the object a name was written for unqualified", () => {
    // `coins` and `fake_coins` are both called "Coins" in the content.
    expect(itemName(617)).toBe("Coins (fake)");
  });

  it("falls back to a name, never to a bare id", () => {
    expect(itemName(999_999)).toBe("Item 999999");
    expect(itemName(-1)).toBe("Unknown item");
    expect(itemName(1.5)).toBe("Unknown item");
    // The eleven placeholder objects have no model and no name in the config,
    // so they are not in the table at all.
    expect(Object.hasOwn(NAMES, "599")).toBe(false);
    expect(itemName(599)).toBe("Item 599");
  });
});

describe("the generated table", () => {
  it("is a flat {id: name} map with numeric string keys", () => {
    for (const [id, name] of Object.entries(table)) {
      expect(id).toMatch(/^\d+$/);
      expect(typeof name).toBe("string");
      expect(name).not.toBe("");
    }
  });

  it("gives no two ids the same name", () => {
    const seen = new Map<string, string>();
    for (const [id, name] of Object.entries(table)) {
      expect(seen.get(name as string)).toBeUndefined();
      seen.set(name as string, id);
    }
  });

  it("covers the whole 2004 object list", () => {
    // 3894 ids in `content/pack/obj.pack` less the eleven unnamed placeholders.
    expect(Object.keys(NAMES)).toHaveLength(3883);
  });
});
