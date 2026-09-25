import { displayName } from "@/lib/hiscores/format";
import { parseId } from "@/lib/messages/queries";

import { GZ_TAKE_MAX, type Gz } from "./queries";

/**
 * "gz" on adventures, as the timeline draws and changes it: a level run's gz
 * gathered from its levels, what pressing gz sends and the change it makes
 * before the server answers, and who gave it, in words. Migration 15 keeps one row
 * per (adventure, giver); `adventure_timeline` answers each adventure's
 * count, its newest fifty givers by username and whether the viewer is one.
 *
 * Pure and client-safe.
 */

export type { Gz };
export { GZ_TAKE_MAX };

/** The most givers an adventure's gz names (the timeline's newest fifty). */
export const GZ_NAMES = 50;

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

/**
 * The gz once the owner has blocked `name`: the timeline leaves blocked
 * givers out, so they go from the names and the count. When they are not
 * among the names (a list cut short), nothing changes until a reload.
 */
export function withoutGiver(gz: Gz, name: string): Gz {
  if (!gz.names.includes(name)) return gz;
  return { count: Math.max(gz.count - 1, 0), names: gz.names.filter((given) => given !== name), mine: gz.mine };
}

/** One request to `/api/adventurer-log/gz`, and the adventures it is about. */
export type GzRequest =
  | { method: "POST"; body: { event: number }; ids: number[] }
  | { method: "DELETE"; body: { events: number[] }; ids: number[] };

/**
 * What pressing gz does: `taking` it back or giving one, the adventures whose
 * gz `change` at once, and the requests to send, in order.
 */
export type GzPlan = { taking: boolean; change: number[]; requests: GzRequest[] };

/**
 * The plan for pressing gz on one adventure, or on a level run's (newest
 * first). When any of them has the viewer's gz, it is taken back from every
 * one, in batches of `GZ_TAKE_MAX`; otherwise one is given, to the newest.
 */
export function gzPlan(events: readonly { id: number; gz: Gz }[]): GzPlan {
  if (events.length === 0) return { taking: false, change: [], requests: [] };

  if (!runGz(events).mine) {
    const id = events[0].id;
    return { taking: false, change: [id], requests: [{ method: "POST", body: { event: id }, ids: [id] }] };
  }

  const change = events.map((event) => event.id);
  const requests: GzRequest[] = [];
  for (let i = 0; i < change.length; i += GZ_TAKE_MAX) {
    const ids = change.slice(i, i + GZ_TAKE_MAX);
    requests.push({ method: "DELETE", body: { events: ids }, ids });
  }
  return { taking: true, change, requests };
}

/**
 * The adventures to put back as they were when request `failed` of `plan`
 * is refused: its own and those of every request after it, which were never
 * sent. The ones before it went through, so they stay as they are.
 */
export function gzRestoreIds(plan: GzPlan, failed: number): number[] {
  return plan.requests.slice(failed).flatMap((request) => request.ids);
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
