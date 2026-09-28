"use client";

import { useState } from "react";

import OutfitEditor from "@/components/outfits/OutfitEditor";
import type { Look } from "@/lib/chathead/look";
import { emptyOutfits, memoryStore } from "@/lib/chathead/outfit-store";
import { OUTFIT_SLOTS } from "@/lib/chathead/validate";

/**
 * A man in rune armour — green hair and beard, hidden under the full helm
 * until he takes it off — is what "Import from game" hands the development
 * page, in place of a real save.
 */
const IMPORTED: Look = {
  gender: 0,
  kits: [2, 11, 18, 26, 33, 36, 42],
  colours: [9, 0, 0, 0, 1],
  worn: [1163, -1, -1, -1, 1127, 1201, -1, 1079, -1, -1, -1, -1, -1, -1],
};

/**
 * The editor over an in-memory store; nothing is kept past a reload. The
 * site moves between outfits on Character › Look; here a select does, and
 * switching drops an unsaved draft without asking.
 */
export default function DevOutfits() {
  const [store] = useState(() => memoryStore(emptyOutfits(), IMPORTED));
  const [saved, setSaved] = useState(emptyOutfits);
  const [slot, setSlot] = useState(0);

  return (
    <>
      <p>
        <label>
          Slot{" "}
          <select value={slot} onChange={(event) => setSlot(Number(event.target.value))}>
            {Array.from({ length: OUTFIT_SLOTS }, (_, i) => (
              <option key={i} value={i}>
                {i + 1}: {saved.outfits[i]?.name ?? "empty"}
                {saved.defaultSlot === i ? " (wearing)" : ""}
              </option>
            ))}
          </select>
        </label>
      </p>
      <OutfitEditor key={slot} slot={slot} initial={saved} store={store} onChange={setSaved} />
    </>
  );
}
