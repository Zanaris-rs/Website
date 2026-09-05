import { ORIGINAL_RULES } from "@/lib/rules/original";

/**
 * The two columns of `/staff/reports` that arrive as bare integers, put into
 * words.
 *
 * Both encodings belong to the engine and neither is written down anywhere the
 * website can see at build time, so both are transcribed here with the source
 * named — that is the only honest way to carry a foreign encoding across a
 * repo boundary.
 */

/**
 * `reason` is `ReportAbuseReason` from
 * `engine/src/network/game/client/model/ReportAbuse.ts`: a zero-based enum
 * running OFFENSIVE_LANGUAGE (0) to REAL_WORLD_TRADING (11), in the same order
 * as the twelve rules the client's Report Abuse panel lists.
 *
 * So the label is rule `reason + 1`, taken from `lib/rules/original.ts` rather
 * than typed out again: the rules page and the staff page then cannot disagree
 * about what rule 7 is called, and a report links to a rule a reader can go
 * and check.
 */
export const FIRST_REPORT_REASON = 0;
export const LAST_REPORT_REASON = ORIGINAL_RULES.length - 1;

export function reportReasonLabel(reason: number | null): string {
  if (reason === null || !Number.isInteger(reason)) return "unknown";
  const rule = ORIGINAL_RULES.find((entry) => entry.n === reason + 1);
  // The handler refuses anything outside the enum before the packet is ever
  // forwarded, so an out-of-range number here means the enum grew and this
  // build has not caught up. Showing the raw number is more useful than a
  // wrong rule name.
  return rule ? `${rule.n}. ${rule.caption}` : `Rule ${reason + 1}`;
}

/**
 * `coord` is `CoordGrid.packCoord(level, x, z)` from
 * `engine/src/engine/CoordGrid.ts`:
 *
 *     (z & 0x3fff) | ((x & 0x3fff) << 14) | ((level & 0x3) << 28)
 *
 * Unsigned shifts, because the packed value uses bit 29 and `>>` would sign
 * extend a coordinate on the top level of a far-east map square.
 */
export type Coord = { readonly level: number; readonly x: number; readonly z: number };

export function unpackCoord(coord: number): Coord | null {
  if (!Number.isInteger(coord) || coord < 0) return null;
  return {
    level: (coord >>> 28) & 0x3,
    x: (coord >>> 14) & 0x3fff,
    z: coord & 0x3fff,
  };
}

/** "3200, 3200" on the ground, "3200, 3200 (level 1)" above it. */
export function coordLabel(coord: number | null): string {
  if (coord === null) return "unknown";
  const unpacked = unpackCoord(coord);
  if (!unpacked) return "unknown";
  const { level, x, z } = unpacked;
  return level === 0 ? `${x}, ${z}` : `${x}, ${z} (level ${level})`;
}

/** "World 1" / "unknown" — rows written before Part 3 know neither world nor reporter. */
export function worldLabel(world: number | null): string {
  return typeof world === "number" ? `World ${world}` : "unknown";
}

/** A reporter with no account row behind it: the login server wrote `null`. */
export function reporterLabel(reporter: string): string {
  return reporter === "" ? "unknown" : reporter;
}
