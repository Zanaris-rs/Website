import { describe, expect, it } from "vitest";

import { emptyOutfits, memoryStore } from "./outfit-store";
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
