import type { Look } from "@/lib/chathead/look";
import type { SavedOutfits } from "@/lib/chathead/outfit-store";

/** One saved outfit, as the Wardrobe on a log shows it. */
export type WardrobeOutfit = { slot: number; name: string; look: Look; isDefault: boolean };

/**
 * The Wardrobe is every outfit the owner saved, in slot order, with the one
 * that is their picture marked. Empty slots are left out.
 */
export function wardrobeOf(saved: SavedOutfits): WardrobeOutfit[] {
  return saved.outfits.flatMap((outfit, slot) =>
    outfit ? [{ slot, name: outfit.name, look: outfit.look, isDefault: saved.defaultSlot === slot }] : [],
  );
}
