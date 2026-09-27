import { describe, expect, it } from "vitest";

import { itemIconSrc } from "@/lib/items/icons";
import { allItemIds, isNote } from "@/lib/items/objects";

import { CREST_RESULTS, CURATED_CRESTS, crestName, isCrest, searchCrests } from "./crests";

describe("CURATED_CRESTS", () => {
  it("are 48 different items, each one a crest can be, the rune scimitar first", () => {
    expect(CURATED_CRESTS).toHaveLength(48);
    expect(new Set(CURATED_CRESTS).size).toBe(48);
    expect(CURATED_CRESTS[0]).toBe(1333);
    for (const id of CURATED_CRESTS) {
      expect(isCrest(id), String(id)).toBe(true);
      expect(isNote(id)).toBe(false);
      expect(itemIconSrc(id)).not.toBeNull();
      expect(crestName(id)).not.toMatch(/^Item \d+$/);
    }
  });
});

describe("isCrest", () => {
  it("is any named item that is not a note and has an icon", () => {
    expect(isCrest(1333)).toBe(true);
    expect(isCrest(1334)).toBe(false); // Rune scimitar (noted)
    expect(isCrest(798)).toBe(false); // an id the client draws as nothing
    for (const bad of [-1, 65536, 1.5, Number.NaN]) expect(isCrest(bad)).toBe(false);
  });

  it("refuses a placeholder with an icon but no name, which no search can offer", () => {
    // Not in allItemIds(), so the picker never shows them, and a route must not take them.
    for (const placeholder of [599, 3667]) {
      expect(itemIconSrc(placeholder)).not.toBeNull();
      expect(isCrest(placeholder)).toBe(false);
    }
  });

  it("takes exactly the ids a search can offer: named, not a note, with an icon", () => {
    const named = new Set(allItemIds());
    for (let id = 0; id <= 4000; id++) {
      expect(isCrest(id), String(id)).toBe(named.has(id) && !isNote(id) && itemIconSrc(id) !== null);
    }
  });

  it("names a crest by its item", () => {
    expect(crestName(1333)).toBe("Rune scimitar");
    expect(crestName(1038)).toBe("Red partyhat");
  });
});

describe("searchCrests", () => {
  it("offers the curated list for no query", () => {
    expect(searchCrests("")).toEqual(CURATED_CRESTS.map((id) => ({ id, name: crestName(id) })));
    expect(searchCrests("   ")).toEqual(searchCrests(""));
  });

  it("searches every item, never a note, names that start with the query first", () => {
    const hats = searchCrests("Partyhat");
    expect(hats.map((hat) => hat.id).sort((a, b) => a - b)).toEqual([1038, 1040, 1042, 1044, 1046, 1048]);

    const rune = searchCrests("rune");
    expect(rune).toHaveLength(CREST_RESULTS);
    expect(rune.every((crest) => crest.name.toLowerCase().startsWith("rune"))).toBe(true);
    expect(rune.every((crest) => isCrest(crest.id))).toBe(true);
    expect(searchCrests("lobster").some((crest) => crest.name.includes("noted"))).toBe(false);
  });

  it("finds nothing for nonsense or a query too long to be a name", () => {
    expect(searchCrests("zzqqxxvv")).toEqual([]);
    expect(searchCrests("x".repeat(41))).toEqual([]);
  });
});
