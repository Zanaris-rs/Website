"use client";

import { useState } from "react";

import { CHARACTER_HREF } from "@/lib/adventurer-log/href";
import type { SavedOutfits } from "@/lib/chathead/outfit-store";
import { apiStore } from "@/lib/outfits/api-store";

import OutfitEditor from "./OutfitEditor";

/** The outfit editor over the site's own routes (`/api/outfits`), for the account's editor page. */
export default function AccountOutfitEditor({
  slot,
  initial,
  importOnLoad,
}: {
  slot: number;
  initial: SavedOutfits;
  importOnLoad: boolean;
}) {
  const [store] = useState(apiStore);
  return (
    <OutfitEditor slot={slot} initial={initial} store={store} importOnLoad={importOnLoad} lookHref={CHARACTER_HREF} />
  );
}
