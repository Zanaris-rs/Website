import { itemIconSrc } from "@/lib/items/icons";
import { itemName } from "@/lib/items/names";
import { allItemIds, isNote } from "@/lib/items/objects";

/**
 * A clan's crest: any item in the game, drawn on a shield (`Crest.tsx`).
 * Migration 17 only checks the range (0-65535); the site says which items
 * can be one - a named item, not a bank note, and with an icon to draw - the
 * post picker's two checks (`lib/adventurer-log/assets.ts`) over the search's
 * own domain, so a route takes exactly what the picker can offer.
 *
 * Server-side only in practice: the item tables are big, so the browser
 * asks `/api/clans/crests` instead of loading this module.
 */

/**
 * The picker's list before anyone types: weapons and armour, magic, the
 * gods, treasures, and the skills' catches, 48 of them. The first is where a
 * new clan starts. Each id was checked against `lib/items/names.json` and
 * `icons.json`; the test holds them to it.
 */
export const CURATED_CRESTS: readonly number[] = [
  1333, // Rune scimitar (the default)
  1319, // Rune 2h sword
  1305, // Dragon longsword
  1377, // Dragon battleaxe
  1215, // Dragon dagger
  1249, // Dragon spear
  1434, // Dragon mace
  1163, // Rune full helm
  1149, // Dragon med helm
  1187, // Dragon sq shield
  1201, // Rune kiteshield
  859, // Magic longbow
  837, // Crossbow
  35, // Excalibur
  2402, // Silverlight
  1389, // Magic staff
  1387, // Staff of fire
  556, // Air rune
  555, // Water rune
  557, // Earth rune
  554, // Fire rune
  565, // Blood rune
  560, // Death rune
  563, // Law rune
  561, // Nature rune
  1718, // Holy symbol
  1724, // Unholy symbol
  2412, // Cape of saradomin
  2413, // Cape of guthix
  2414, // Cape of zamorak
  1052, // Cape of legends
  1038, // Red partyhat
  1042, // Blue partyhat
  1050, // Santa hat
  962, // Christmas cracker
  995, // Coins
  1704, // Amulet of glory
  1601, // Diamond
  1615, // Dragonstone
  989, // Crystal key
  379, // Lobster
  385, // Shark
  1891, // Cake
  1917, // Beer
  1515, // Yew logs
  1275, // Rune pickaxe
  964, // Skull
  536, // Dragon bones
];

/** The most a search answers; the picker's grid scrolls past a few rows. */
export const CREST_RESULTS = 48;

/** Every item with a name: the domain the search runs over, built once. */
let named: ReadonlySet<number> | null = null;

/**
 * An item the picker could offer: named (so a search can find it), not a
 * note, and with an icon. A few placeholders have an icon and no name; no
 * search shows them, so no route takes them either.
 */
export function isCrest(id: number): boolean {
  named ??= new Set(allItemIds());
  return named.has(id) && id <= 65535 && !isNote(id) && itemIconSrc(id) !== null;
}

export function crestName(id: number): string {
  return itemName(id);
}

/**
 * The picker's search: with no query the curated list, otherwise every item
 * that can be a crest whose name holds the query. Names that start with it
 * come first, then the shortest, then by name. Unlike the post picker it
 * sorts before it cuts, so a "rune" search is every "Rune ..." first.
 */
export function searchCrests(raw: string): { id: number; name: string }[] {
  const q = raw.trim().toLowerCase();
  if (q === "") return CURATED_CRESTS.map((id) => ({ id, name: crestName(id) }));
  if (q.length > 40) return [];

  const matches: { id: number; name: string }[] = [];
  for (const id of allItemIds()) {
    if (!isCrest(id)) continue;
    const name = crestName(id);
    if (name.toLowerCase().includes(q)) matches.push({ id, name });
  }
  const rank = (match: { name: string }) => (match.name.toLowerCase().startsWith(q) ? 0 : 1);
  return matches
    .sort(
      (a, b) =>
        rank(a) - rank(b) || a.name.length - b.name.length || a.name.localeCompare(b.name) || a.id - b.id,
    )
    .slice(0, CREST_RESULTS);
}
