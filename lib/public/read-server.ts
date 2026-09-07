import "server-only";

import { isConfigured, query } from "@/lib/db";
import { groupIdMap } from "@/lib/items/groups";

import {
  BANS_PAGE_SIZE,
  type Census,
  ECONOMY_DEFAULT_WINDOW,
  type EconomyWindow,
  type Flow,
  type GroupRange,
  type PunishmentPage,
  type Snapshot,
  type StaffSpawn,
  parseCensus,
  parseFlows,
  parseGroupRanges,
  parsePunishmentPage,
  parseSnapshots,
  parseStaffSpawns,
  publicEconomyFlowStatement,
  publicEconomyGroupRangeStatement,
  publicEconomyLatestStatement,
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
  readonly window: EconomyWindow;
  readonly snapshots: readonly Snapshot[];
  /**
   * The newest census, whole: every id in the game, which is what the category
   * blocks are counted from.
   *
   * `null` covers two things the page can tell apart on its own, from whether
   * `snapshots` has anything in it: no census has run yet, or this read failed.
   * Either way the category blocks cannot be drawn and the rest of the page
   * still can, which is the whole reason this is not fatal — see `loadEconomy`.
   */
  readonly census: Census | null;
  /**
   * `null` when the read failed, which is **not** the same as an empty list.
   * "Nothing entered or left the game" and "we could not find out" are
   * different sentences, and a page that prints the first when it means the
   * second is telling the reader something untrue about the economy.
   */
  readonly flows: readonly Flow[] | null;
  readonly spawns: readonly StaffSpawn[] | null;
  /**
   * Each category's lowest and highest total across the window, keyed by group,
   * with `"*"` for everything no group named. `null` if the read failed.
   */
  readonly ranges: ReadonlyMap<string, GroupRange> | null;
};

/**
 * One window of census, in five reads that go together.
 *
 * They are one `Promise.all` because they are one page and five round trips in
 * series would be five times the latency for no benefit. `lib/db.ts` keeps a
 * pool of two, so they do not all leave at once — and that is fine: every one
 * of these pages is `revalidate = 300`, so the queueing costs a background
 * regeneration a few hundred milliseconds and costs a reader nothing. A bigger
 * pool would buy latency nobody is waiting on, at the price of idle sockets on
 * every serverless instance the site scales out to.
 *
 * The failures are kept apart. The snapshots and the census are the page, so
 * losing either is losing the page; the flows, the staff spawns and the ranges
 * are blocks *on* it — one of them failing should cost that block and not the
 * totals above it — and the block says "could not be read", never "nothing
 * happened".
 *
 * `groupIdMap()` is called here rather than in `queries.ts` so that the
 * statement builders stay testable without the 3,883-entry object table.
 */
export async function loadEconomy(
  window: EconomyWindow = ECONOMY_DEFAULT_WINDOW,
): Promise<Load<Economy>> {
  const days = window.days;

  const [snapshots, census, flows, spawns, ranges] = await Promise.all([
    read("economy", publicEconomyStatement(days), parseSnapshots),
    read("economy census", publicEconomyLatestStatement(), parseCensus),
    read("economy flow", publicEconomyFlowStatement(days), parseFlows),
    read("staff spawns", publicStaffSpawnsStatement(days), parseStaffSpawns),
    read(
      "economy group range",
      publicEconomyGroupRangeStatement(days, groupIdMap()),
      parseGroupRanges,
    ),
  ]);

  // Only the snapshots are the page. The census is *not*, deliberately: it is
  // the one read that depends on migration 5, and the site deploys on a push
  // while the migration is applied by hand at a psql prompt. Between those two
  // events `public_economy_latest()` does not exist, and a fatal read would
  // turn /economy into a blank "unavailable" panel for the whole window rather
  // than the page it was the day before, minus its newest block.
  if (snapshots.status !== "ok") return { status: "unavailable" };

  return {
    status: "ok",
    data: {
      window,
      snapshots: snapshots.data,
      census: census.status === "ok" ? census.data : null,
      flows: flows.status === "ok" ? flows.data : null,
      spawns: spawns.status === "ok" ? spawns.data : null,
      ranges: ranges.status === "ok" ? ranges.data : null,
    },
  };
}
