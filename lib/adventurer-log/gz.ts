import { displayName } from "@/lib/hiscores/format";
import { parseId } from "@/lib/messages/queries";

import type { Gz } from "./queries";

/**
 * "gz" on adventures, as the timeline draws and changes it: a level run's gz
 * gathered from its levels, the change a give or a take-back makes before
 * the server answers, and who gave it, in words. Migration 15 keeps one row
 * per (adventure, giver); `adventure_timeline` answers each adventure's
 * count, its newest fifty givers by username and whether the viewer is one.
 *
 * Pure and client-safe.
 */

export type { Gz };

/** The most givers an adventure's gz names (the timeline's newest fifty). */
export const GZ_NAMES = 50;

/** The most adventures one take-back names: `adventure_gz_take` reads the first fifty. */
export const GZ_TAKE_MAX = 50;

/**
 * A level run's gz: everyone who gave one to any level in it, counted once,
 * the newest level's givers first. When a level names fewer givers than it
 * counts, nobody can tell who else is in two lists, so the count is the sum
 * of the levels' counts (never fewer than the names).
 */
export function runGz(events: readonly { gz: Gz }[]): Gz {
  const names: string[] = [];
  const seen = new Set<string>();
  let sum = 0;
  let capped = false;
  let mine = false;

  for (const { gz } of events) {
    sum += gz.count;
    if (gz.names.length < gz.count) capped = true;
    if (gz.mine) mine = true;
    for (const name of gz.names) {
      if (seen.has(name)) continue;
      seen.add(name);
      names.push(name);
    }
  }

  return { count: capped ? Math.max(sum, names.length) : names.length, names, mine };
}

/** The gz once `me` has given one: first among the names, and counted. */
export function withGiven(gz: Gz, me: string): Gz {
  if (gz.mine) return gz;
  return { count: gz.count + 1, names: [me, ...gz.names.filter((name) => name !== me)], mine: true };
}

/** The gz once `me` has taken theirs back. */
export function withTaken(gz: Gz, me: string): Gz {
  if (!gz.mine) return gz;
  return { count: Math.max(gz.count - 1, 0), names: gz.names.filter((name) => name !== me), mine: false };
}

/** "Lynx Titan, B0aty and 3 more": the newest fifty givers by display name. */
export function gzWho(gz: Gz): string {
  const shown = gz.names.slice(0, GZ_NAMES).map(displayName);
  const more = gz.count - shown.length;
  if (shown.length === 0) return "";
  return more > 0 ? `${shown.join(", ")} and ${more} more` : shown.join(", ");
}

/**
 * The adventures a take-back names (`DELETE /api/adventurer-log/gz`
 * `{ events }`): one to fifty row ids, or null for a request that is not
 * that.
 */
export function takeIds(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > GZ_TAKE_MAX) return null;
  const ids: number[] = [];
  for (const value of raw) {
    const id = typeof value === "number" ? parseId(String(value)) : null;
    if (id === null) return null;
    ids.push(id);
  }
  return ids;
}
