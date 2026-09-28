import { OUTFIT_SLOTS } from "@/lib/chathead/limits";

/**
 * Where the Adventurer Log lives on the site. A player's public page is
 * `/adventurer/<name>` and the directory of every log is `/adventurers`;
 * every link to either goes through here, so the address is one edit.
 *
 * The old `/adventurer-log/...` addresses redirect here (next.config.ts).
 * The API (`/api/adventurer-log/...`) keeps its paths.
 *
 * The owner has three homes (sprint 5): Character (who you are - Look,
 * Words and Sheet, and the outfit editor under Look), Clan (who you're
 * with) and Log settings (how the log reads). Every link to them comes from
 * here too. The old Outfits page redirects to Character (next.config.ts).
 */

export const DIRECTORY_HREF = "/adventurers";

export function logHref(username: string): string {
  return `/adventurer/${encodeURIComponent(username)}`;
}

export const CHARACTER_HREF = "/account/adventurer-log/character";
export const WORDS_HREF = CHARACTER_HREF + "/words";
export const SHEET_HREF = CHARACTER_HREF + "/sheet";
export const CLAN_TAB_HREF = "/account/adventurer-log/clan";
export const LOG_SETTINGS_HREF = "/account/adventurer-log";

/** The outfit editor for a 0-based slot; its address counts from 1, as players do. */
export function outfitEditHref(slot0: number): string {
  return `${CHARACTER_HREF}/outfit/${slot0 + 1}`;
}

/** The outfit editor, importing the look from the game into the slot as it opens. */
export function outfitImportHref(slot0: number): string {
  return `${outfitEditHref(slot0)}?import=1`;
}

/** The editor's `[slot]` segment, "1" to "10", as a 0-based slot; null for anything else. */
export function outfitSlotFrom(raw: string): number | null {
  if (!/^[1-9][0-9]?$/.test(raw)) return null;
  const slot = Number(raw);
  return slot <= OUTFIT_SLOTS ? slot - 1 : null;
}
