import type { Look } from "./look.ts";
import { OUTFIT_SLOTS, type Outfit } from "./validate.ts";

/**
 * Where the outfit editor keeps a player's outfits. The editor only talks to
 * this, so the same component runs against the database (the account page,
 * through route handlers) and against memory (`/dev/outfits`).
 */

export type SavedOutfits = {
  /** Always OUTFIT_SLOTS long; null is an empty slot. */
  outfits: (Outfit | null)[];
  /** The slot whose chathead is the player's picture, if any. */
  defaultSlot: number | null;
};

export type OutfitStore = {
  save(slot: number, outfit: Outfit): Promise<SavedOutfits>;
  remove(slot: number): Promise<SavedOutfits>;
  setDefault(slot: number): Promise<SavedOutfits>;
  /**
   * The look from the player's last save in game, or null if the game has not
   * recorded one yet. Absent when importing is not available at all.
   */
  importLook?: () => Promise<Look | null>;
};

export function emptyOutfits(): SavedOutfits {
  return { outfits: new Array(OUTFIT_SLOTS).fill(null), defaultSlot: null };
}

/** An in-memory store, for the development page and for tests. */
export function memoryStore(
  initial: SavedOutfits = emptyOutfits(),
  importable: Look | null = null,
): OutfitStore {
  let state: SavedOutfits = {
    outfits: [...initial.outfits],
    defaultSlot: initial.defaultSlot,
  };
  const next = (change: Partial<SavedOutfits>) => {
    state = { ...state, ...change };
    return Promise.resolve(state);
  };

  return {
    save(slot, outfit) {
      const outfits = [...state.outfits];
      outfits[slot] = outfit;
      // The first outfit a player saves becomes their picture.
      const defaultSlot = state.defaultSlot ?? slot;
      return next({ outfits, defaultSlot });
    },
    remove(slot) {
      const outfits = [...state.outfits];
      outfits[slot] = null;
      const defaultSlot = state.defaultSlot === slot ? null : state.defaultSlot;
      return next({ outfits, defaultSlot });
    },
    setDefault(slot) {
      if (!state.outfits[slot]) return Promise.reject(new Error("empty slot"));
      return next({ defaultSlot: slot });
    },
    importLook: () => Promise.resolve(importable),
  };
}
