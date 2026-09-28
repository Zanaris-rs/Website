import { ADVENTURE_CATEGORIES, maskOf } from "./categories";

/**
 * The parts of an Adventurer Log its owner can hide in Log settings
 * (migration 18's `adventure_log_profile.hidden_parts`), a bit each. Like
 * the kinds of adventure (`categories.ts`), a hidden part is hidden for
 * everyone, the owner included; the log neither draws it nor reads its data
 * (`page-data.ts`, `LogView`), and no API serves it (`readPart`). The
 * character card and Skills are always shown: the card is who the owner is,
 * and the hiscores are public anyway.
 */

export const PART_KEYS = ["dialogue", "wardrobe", "records", "about", "adventures"] as const;
export type PartKey = (typeof PART_KEYS)[number];

export const PART_BITS: Record<PartKey, number> = { dialogue: 1, wardrobe: 2, records: 4, about: 8, adventures: 16 };

/** Every part hidden: the most `hidden_parts` holds (its CHECK, and `parseLog`'s). */
export const PARTS_MASK_MAX = 31;

export const PART_LABELS: Record<PartKey, string> = {
  dialogue: "Dialogue",
  wardrobe: "Wardrobe",
  records: "Records",
  about: "About",
  adventures: "Adventures",
};

export function isPartHidden(mask: number, key: PartKey): boolean {
  return (mask & PART_BITS[key]) !== 0;
}

/** The mask for a set of hidden parts. */
export function partsMaskOf(keys: Iterable<PartKey>): number {
  let mask = 0;
  for (const key of keys) mask |= PART_BITS[key];
  return mask;
}

/**
 * The gate every read of a hideable part goes through - the log page's
 * (`page-data.ts`) and the timeline API's alike: `read()` when the part is
 * shown; when it is hidden, `empty`, the answer a log with nothing in that
 * part gives, and nothing is read. So a hidden part can't be told from an
 * empty one, by anyone: the owner too, who turns it back on in Log settings.
 */
export async function readPart<T, E = T>(
  mask: number,
  key: PartKey,
  read: () => Promise<T>,
  empty: E,
): Promise<T | E> {
  return isPartHidden(mask, key) ? empty : read();
}

const isPartKey = (value: unknown): value is PartKey => (PART_KEYS as readonly unknown[]).includes(value);
const KNOWN_CATEGORIES = new Set(ADVENTURE_CATEGORIES.map((category) => category.id));

/**
 * Log settings' one Save, `{ hiddenCategories: number[], hiddenParts: PartKey[] }`,
 * as the two masks `adventure_log_save_shows` takes. Anything else - an id
 * no adventure is filed under, a part that is always shown - is a
 * `bad_request`: the page only ever sends what it lists.
 */
export function checkShowsInput(
  raw: unknown,
): { ok: true; value: { categories: number; parts: number } } | { ok: false; error: string } {
  const input = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  const categories = input?.hiddenCategories;
  const parts = input?.hiddenParts;
  if (!Array.isArray(categories) || !categories.every((id) => KNOWN_CATEGORIES.has(id as number))) {
    return { ok: false, error: "bad_request" };
  }
  if (!Array.isArray(parts) || !parts.every(isPartKey)) return { ok: false, error: "bad_request" };
  return { ok: true, value: { categories: maskOf(categories as number[]), parts: partsMaskOf(parts) } };
}

/** One box of Log settings' picture of the log. */
export type SchematicBlock = { key: PartKey | "card" | "skills"; label: string; height: number };

const SIDE: readonly SchematicBlock[] = [
  { key: "card", label: "Character card", height: 92 },
  { key: "wardrobe", label: PART_LABELS.wardrobe, height: 38 },
  { key: "skills", label: "Skills", height: 44 },
  { key: "records", label: PART_LABELS.records, height: 22 },
];
const MAIN: readonly SchematicBlock[] = [
  { key: "dialogue", label: PART_LABELS.dialogue, height: 34 },
  { key: "about", label: PART_LABELS.about, height: 26 },
  { key: "adventures", label: PART_LABELS.adventures, height: 110 },
];

/**
 * The log as visitors see it, as Log settings draws it beside the ticks: its
 * narrow column and its wide one, top to bottom, the hidden parts left out.
 */
export function schematic(mask: number): { side: SchematicBlock[]; main: SchematicBlock[] } {
  const shown = (block: SchematicBlock) =>
    block.key === "card" || block.key === "skills" || !isPartHidden(mask, block.key);
  return { side: SIDE.filter(shown), main: MAIN.filter(shown) };
}
