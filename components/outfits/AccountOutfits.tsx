"use client";

import { useState } from "react";

import type { SavedOutfits } from "@/lib/chathead/outfit-store";
import { apiStore } from "@/lib/outfits/api-store";

import OutfitEditor from "./OutfitEditor";

/** The outfit editor over the site's own routes, for the account page. */
export default function AccountOutfits({ initial }: { initial: SavedOutfits }) {
  const [store] = useState(apiStore);
  return <OutfitEditor initial={initial} store={store} />;
}
