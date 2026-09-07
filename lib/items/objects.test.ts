import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import costs from "./costs.json";
import debugnames from "./debugnames.json";
import names from "./names.json";
import { allItemIds, baseIdOf, debugName, isNote, itemCost } from "./objects";

/**
 * The two generated tables beside `names.json`, and the four accessors over
 * them. Same principle as `names.test.ts`: the *shape* a regeneration has to
 * keep, plus the handful of rows that would break /economy quietly if the
 * generator were edited badly.
 */

describe("the generated tables", () => {
  it("name and debugname the same 3883 objects", () => {
    expect(Object.keys(debugnames)).toEqual(Object.keys(names));
    expect(Object.keys(debugnames)).toHaveLength(3883);
  });

  it("prices a subset of them, and only with whole non-negative numbers", () => {
    const ids = Object.keys(costs);
    expect(ids.every((id) => Object.hasOwn(names, id))).toBe(true);

    for (const value of Object.values(costs)) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it("leaves 912 of the 3883 unpriced, which is the fact /economy is built on", () => {
    // `ObjType.cost` defaults to 1 when a config omits the line, so an entry
    // here has to mean "the config said so". If this number ever equals 3883,
    // the generator has started writing the default and every shop value on
    // /economy has quietly become fiction.
    expect(Object.keys(costs)).toHaveLength(2971);
    expect(3883 - Object.keys(costs).length).toBe(912);
  });

  it("keeps the `cert_` prefix, which is the only thing that marks a note", () => {
    expect(debugName(440)).toBe("iron_ore");
    expect(debugName(441)).toBe("cert_iron_ore");
    expect(Object.values(debugnames).filter((name) => name.startsWith("cert_"))).toHaveLength(1265);
  });
});

describe("isNote / baseIdOf", () => {
  it("resolves a note to the object it is a note for", () => {
    expect(isNote(441)).toBe(true);
    expect(baseIdOf(441)).toBe(440);
    expect(isNote(440)).toBe(false);
    expect(baseIdOf(440)).toBe(440);
  });

  it("resolves every note in the game, by name and not by arithmetic", () => {
    // `id - 1` is right for almost all of them, which is exactly what makes it
    // dangerous: the one it is wrong about would silently move a count onto a
    // neighbouring object. Every note must resolve to a real, non-note object.
    for (const id of allItemIds()) {
      if (!isNote(id)) continue;
      const base = baseIdOf(id);
      expect(base).not.toBe(id);
      expect(isNote(base)).toBe(false);
      expect(debugName(id)).toBe(`cert_${debugName(base)}`);
    }
  });

  it("leaves an id it has never heard of alone", () => {
    expect(baseIdOf(999_999)).toBe(999_999);
    expect(isNote(999_999)).toBe(false);
    expect(debugName(-1)).toBe("");
  });
});

describe("itemCost", () => {
  it("returns the declared price", () => {
    expect(itemCost(440)).toBe(17); // iron ore
    expect(itemCost(453)).toBe(45); // coal
    expect(itemCost(556)).toBe(4); // air rune
    expect(itemCost(1050)).toBe(160); // santa hat
  });

  it("returns null for an object whose config declares none", () => {
    // Not 1. These are the rows that would turn a Rares block into a shop
    // window valuing nine hundred partyhats at nine hundred coins.
    expect(itemCost(1038)).toBeNull(); // red partyhat
    expect(itemCost(962)).toBeNull(); // christmas cracker
    expect(itemCost(995)).toBeNull(); // coins
    expect(itemCost(526)).toBeNull(); // bones
  });

  it("prices a note exactly when its base is priced", () => {
    // `ObjType.toCertificate` copies cost from the linked object.
    for (const id of allItemIds()) {
      if (!isNote(id)) continue;
      expect(itemCost(id)).toBe(itemCost(baseIdOf(id)));
    }
  });

  it("is null rather than throwing for a bad id", () => {
    expect(itemCost(999_999)).toBeNull();
    expect(itemCost(-1)).toBeNull();
    expect(itemCost(1.5)).toBeNull();
  });
});

describe("the content repo, when it is checked out beside this one", () => {
  // The generated tables are committed, so the suite passes without the content
  // repo. When it *is* there, this catches the case the commit cannot: somebody
  // bumped the content and did not re-run `npm run items:update`.
  const pack = "../Server/content/pack/obj.pack";

  it.skipIf(!existsSync(pack))("has not moved since the tables were generated", () => {
    const ids = readFileSync(pack, "utf8")
      .split("\n")
      .filter((line) => /^\d+=\S+$/.test(line.trim()))
      .length;

    // 3894 in the pack, less the eleven placeholders with no model and no name.
    expect(ids).toBe(3894);
    expect(allItemIds()).toHaveLength(ids - 11);
  });
});
