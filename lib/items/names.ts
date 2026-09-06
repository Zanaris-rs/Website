import table from "./names.json";

/**
 * Item ids as names.
 *
 * The economy census counts objects by id, because that is the only thing a
 * save file holds, and a public page that prints "4151: 3" tells a reader
 * nothing. `names.json` is generated from the content repo by
 * `scripts/update-item-names.sh` — the ids come from `content/pack/obj.pack`,
 * which is where the engine assigns them, and the names from the `[debugname]`
 * blocks in the `*.obj` configs, resolved with the packer's own rules. That
 * script's header documents the whole derivation, including what happens to
 * notes (`cert_*`) and to the handful of objects the 2004 data gives the same
 * name to.
 *
 * It is committed rather than fetched, so a page render never depends on the
 * content repo being checked out next to this one. Re-run the script after a
 * content bump.
 *
 * This module is pure: no database, no React, nothing that cannot run in a
 * test.
 */

const NAMES: Readonly<Record<string, string>> = table;

/**
 * What to call an object, or `Item <id>` for one the client never names.
 *
 * The fallback is a name, not a bare id: eleven ids in the cache are
 * placeholders with no model and no name, and an id the census counted but
 * this table has not heard of (a content bump landing before this file is
 * regenerated) should read as an item rather than as a broken cell.
 */
export function itemName(id: number): string {
  if (!Number.isInteger(id) || id < 0) return "Unknown item";
  return NAMES[String(id)] ?? `Item ${id}`;
}
