import "server-only";

import { isConfigured, query } from "@/lib/db";

import {
  BANS_PAGE_SIZE,
  ECONOMY_DAYS,
  type Flow,
  type PunishmentPage,
  type Snapshot,
  type StaffSpawn,
  parseFlows,
  parsePunishmentPage,
  parseSnapshots,
  parseStaffSpawns,
  publicEconomyFlowStatement,
  publicEconomyStatement,
  publicPunishmentsStatement,
  publicStaffSpawnsStatement,
} from "./queries";

/**
 * The reads behind /bans and /economy.
 *
 * Both pages are public, cached for five minutes, and have no session behind
 * them, so there is no authorisation here at all — the `SECURITY DEFINER`
 * functions decide what is public and this file only asks. What it does do is
 * turn every failure into a verdict rather than an exception, for the same
 * reason `loadStaff` does: a page that renders "unavailable" is a page, and an
 * unhandled throw in a server component is a 500 with the site's chrome
 * missing.
 *
 * A verdict is not the same as an empty result, and the difference matters
 * here more than anywhere else on the site: until the migration is applied and
 * the hourly census has run, these functions return **no rows**, and both
 * pages must render as finished pages saying so. "Nothing to show yet" is a
 * successful read.
 */

export type Load<T> =
  | { readonly status: "ok"; readonly data: T }
  /** No database configured, or the read failed. */
  | { readonly status: "unavailable" };

async function read<T>(
  what: string,
  statement: { text: string; values: readonly unknown[] },
  parse: (rows: readonly unknown[]) => T,
): Promise<Load<T>> {
  if (!isConfigured()) return { status: "unavailable" };
  try {
    const rows = await query<Record<string, unknown>>(
      statement.text,
      statement.values,
    );
    return { status: "ok", data: parse(rows) };
  } catch (error) {
    console.error(`[public] ${what} read failed`, error);
    return { status: "unavailable" };
  }
}

/** One page of the permanent record. `page` is 1-based. */
export function loadPunishments(
  page: number,
  size: number = BANS_PAGE_SIZE,
): Promise<Load<PunishmentPage>> {
  return read("punishments", publicPunishmentsStatement(page, size), (rows) =>
    parsePunishmentPage(rows, page, size),
  );
}

export type Economy = {
  readonly snapshots: readonly Snapshot[];
  /**
   * `null` when the read failed, which is **not** the same as an empty list.
   * "Nothing entered or left the game" and "we could not find out" are
   * different sentences, and a page that prints the first when it means the
   * second is telling the reader something untrue about the economy.
   */
  readonly flows: readonly Flow[] | null;
  readonly spawns: readonly StaffSpawn[] | null;
};

/**
 * A month of census, in three reads that go together.
 *
 * They are one `Promise.all` because they are one page and three round trips
 * in series would be three times the latency for no benefit. The failures are
 * kept apart, though: the snapshots are the page, so losing them is losing the
 * page, while the flows and the staff spawns are blocks *on* it — one of them
 * failing should cost that block and not the totals above it — and the block
 * says "could not be read", never "nothing happened".
 */
export async function loadEconomy(
  days: number = ECONOMY_DAYS,
): Promise<Load<Economy>> {
  const [snapshots, flows, spawns] = await Promise.all([
    read("economy", publicEconomyStatement(days), parseSnapshots),
    read("economy flow", publicEconomyFlowStatement(days), parseFlows),
    read("staff spawns", publicStaffSpawnsStatement(days), parseStaffSpawns),
  ]);

  if (snapshots.status !== "ok") return { status: "unavailable" };

  return {
    status: "ok",
    data: {
      snapshots: snapshots.data,
      flows: flows.status === "ok" ? flows.data : null,
      spawns: spawns.status === "ok" ? spawns.data : null,
    },
  };
}
