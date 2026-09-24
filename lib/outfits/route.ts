import "server-only";

import type { SavedOutfits } from "@/lib/chathead/outfit-store";
import { OUTFIT_SLOTS } from "@/lib/chathead/validate";
import { query } from "@/lib/db";

import { outfitsStatement, parseOutfits } from "./queries";

/**
 * What the four outfit routes (`app/api/outfits/…`) share. Every write
 * answers with the player's outfits as they now are, which is what the
 * editor's `OutfitStore` promises: the page never keeps its own idea of which
 * slot is the default.
 */

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

/** A slot from the URL: "0" to "9" and nothing else. */
export function parseSlot(raw: string): number | null {
  if (!/^\d$/.test(raw)) return null;
  const slot = Number(raw);
  return slot < OUTFIT_SLOTS ? slot : null;
}

export async function readOutfits(username: string): Promise<SavedOutfits> {
  const statement = outfitsStatement(username);
  return parseOutfits(
    await query<Record<string, unknown>>(statement.text, statement.values),
  );
}

export function answer(saved: SavedOutfits): Response {
  return Response.json(saved, { status: 200, headers: NO_STORE });
}
