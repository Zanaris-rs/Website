import costTable from "./costs.json";
import debugnameTable from "./debugnames.json";

/**
 * The two things about an object that are not its name: what the content repo
 * calls it, and what the game says it is worth.
 *
 * Both files are generated beside `names.json` by `scripts/update-item-names.sh`
 * and committed, so a page render never depends on the content repo being
 * checked out next to this one. Re-run the script after a content bump.
 *
 * Pure, like `names.ts`: no database, no React, nothing that cannot run in a
 * test.
 */

const DEBUGNAMES: Readonly<Record<string, string>> = debugnameTable;
const COSTS: Readonly<Record<string, number>> = costTable;

const NOTE_PREFIX = "cert_";

/** The content repo's name for an object — `iron_ore`, `cert_iron_ore` — or `""`. */
export function debugName(id: number): string {
  if (!Number.isInteger(id) || id < 0) return "";
  return DEBUGNAMES[String(id)] ?? "";
}

/**
 * A bank note, rather than the thing it is a note for.
 *
 * The packer synthesises one of these for most tradeable objects
 * (`ObjConfig.packObjConfigs`), giving it a `certlink` back to the original and
 * no config of its own. The debugname is the only thing that distinguishes the
 * two here, which is why `debugnames.json` keeps the prefix.
 */
export function isNote(id: number): boolean {
  return debugName(id).startsWith(NOTE_PREFIX);
}

/** debugname -> id, built once. The reverse of `DEBUGNAMES`, for `baseIdOf`. */
const BY_DEBUGNAME: ReadonlyMap<string, number> = new Map(
  Object.entries(DEBUGNAMES).map(([id, name]) => [name, Number(id)]),
);

/**
 * The object a note is a note for, or the id itself when it is not one.
 *
 * Looked up by name and **not** as `id - 1`. The 2004 data does put most notes
 * directly after their object, but that is a habit of the packer's ordering
 * rather than a rule, and an id arithmetic that is right 1,264 times out of
 * 1,265 is worse than one that is right or absent: it would silently move a
 * count onto whatever object happened to sit below it.
 *
 * A note whose base this table has never heard of stays itself, so its count is
 * still shown somewhere rather than being folded onto nothing.
 */
export function baseIdOf(id: number): number {
  const name = debugName(id);
  if (!name.startsWith(NOTE_PREFIX)) return id;
  return BY_DEBUGNAME.get(name.slice(NOTE_PREFIX.length)) ?? id;
}

/**
 * The shop price the game's own configuration declares, or `null` for an object
 * that declares none.
 *
 * The distinction is the whole reason this file exists. `ObjType.cost` defaults
 * to **1** when a config omits the line, and 912 of the game's 3,883 named
 * objects omit it — every partyhat, the christmas cracker, bones, the grimy
 * herbs, the dragonhides. Reading that default as a price would put a shop
 * value of "912 gp" on a block holding nine hundred partyhats, so the generator
 * writes no entry at all for them and this returns `null`.
 *
 * `null` is not zero either: an unpriced object is one /economy **counts** and
 * does not **value**, and the page says how many of a block's items it could
 * price rather than quietly averaging them in at nothing.
 */
export function itemCost(id: number): number | null {
  if (!Number.isInteger(id) || id < 0) return null;
  return COSTS[String(id)] ?? null;
}

/** Every id that has a name, ascending. The domain every rule in `groups.ts` runs over. */
export function allItemIds(): number[] {
  return Object.keys(DEBUGNAMES)
    .map(Number)
    .sort((a, b) => a - b);
}
