import { describe, expect, it } from "vitest";

import { emptyOutfits, firstEmptySlot, keepSame, memoryStore, type SavedOutfits } from "./outfit-store";
import { defaultLook, OUTFIT_SLOTS } from "./validate";

const outfit = (name: string) => ({ name, look: defaultLook(0) });

describe("memoryStore", () => {
  it("starts with ten empty slots and no picture", () => {
    const empty = emptyOutfits();
    expect(empty.outfits).toHaveLength(OUTFIT_SLOTS);
    expect(empty.outfits.every((slot) => slot === null)).toBe(true);
    expect(empty.defaultSlot).toBeNull();
  });

  it("makes the first saved outfit the picture, and keeps it after", async () => {
    const store = memoryStore();
    expect((await store.save(3, outfit("a"))).defaultSlot).toBe(3);
    expect((await store.save(0, outfit("b"))).defaultSlot).toBe(3);
    expect((await store.setDefault(0)).defaultSlot).toBe(0);
  });

  it("clears the picture when its outfit is deleted", async () => {
    const store = memoryStore();
    await store.save(1, outfit("a"));
    const after = await store.remove(1);
    expect(after.outfits[1]).toBeNull();
    expect(after.defaultSlot).toBeNull();
  });

  it("refuses an empty slot as the picture", async () => {
    await expect(memoryStore().setDefault(5)).rejects.toThrow();
  });

  it("imports whatever look it was given, or null", async () => {
    expect(await memoryStore().importLook!()).toBeNull();
    const look = defaultLook(1);
    expect(await memoryStore(emptyOutfits(), look).importLook!()).toBe(look);
  });
});

/** Ten slots, the first few filled. */
const ten = (...first: (ReturnType<typeof outfit> | null)[]) => [
  ...first,
  ...Array<null>(OUTFIT_SLOTS - first.length).fill(null),
];

describe("firstEmptySlot", () => {
  it("is the first slot with nothing in it, or null when all ten are full", () => {
    expect(firstEmptySlot(emptyOutfits())).toBe(0);
    expect(firstEmptySlot({ outfits: ten(outfit("a"), outfit("b")), defaultSlot: 0 })).toBe(2);
    expect(firstEmptySlot({ outfits: ten(outfit("a"), null, outfit("c")), defaultSlot: 0 })).toBe(1);
    const full = Array.from({ length: OUTFIT_SLOTS }, (_, i) => outfit(`o${i}`));
    expect(firstEmptySlot({ outfits: full, defaultSlot: 0 })).toBeNull();
  });
});

describe("keepSame", () => {
  it("keeps each outfit that did not change as the object it was", () => {
    const before: SavedOutfits = { outfits: ten(outfit("a"), outfit("b")), defaultSlot: 0 };
    const after: SavedOutfits = {
      outfits: ten(outfit("a"), { name: "b", look: defaultLook(1) }, outfit("c")),
      defaultSlot: 1,
    };
    const kept = keepSame(before, after);
    expect(kept.defaultSlot).toBe(1);
    expect(kept.outfits[0]).toBe(before.outfits[0]);
    expect(kept.outfits[1]).toBe(after.outfits[1]);
    expect(kept.outfits[2]).toBe(after.outfits[2]);
    expect(kept.outfits[3]).toBeNull();
  });

  it("takes a renamed outfit, or an emptied slot, as the new answer", () => {
    const before: SavedOutfits = { outfits: ten(outfit("a"), outfit("b")), defaultSlot: 0 };
    const after: SavedOutfits = { outfits: ten(outfit("z"), null), defaultSlot: 0 };
    const kept = keepSame(before, after);
    expect(kept.outfits[0]).toBe(after.outfits[0]);
    expect(kept.outfits[1]).toBeNull();
  });
});
