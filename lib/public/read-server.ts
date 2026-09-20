import "server-only";

import { unstable_cache } from "next/cache";

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
  ECONOMY_WIDEST_WINDOW,
  publicStaffSpawnTotalStatement,
  publicStaffSpawnsAllStatement,
  publicStaffSpawnsStatement,
  parseStaffSpawnTotal,
  type StaffSpawnTotal,
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


/* --- the census, one section at a time --- */

/**
 * Which failures are fatal is a per-page decision, not a shared rule.
 *
 * `loadEconomy` above kept one policy for one page. The census is four pages
 * now and they do not agree: the newest census is a *block* on the overview,
 * which survives without it, and it *is* the catalogue, which does not. So each
 * loader states its own, and none of them abstracts the decision away — the
 * `read` helper stays the shared part, because turning a failure into a verdict
 * is the same job everywhere and deciding what to do about it is not.
 */

/** The whole staff-spawn table, or the ninety-day window when it cannot be had. */
export type SpawnRecord = {
  /** The all-time aggregate, or `null` before migration 7 is applied. */
  readonly total: StaffSpawnTotal | null;
  /** The rows to list. All of them, or the newest window of them. */
  readonly spawns: readonly StaffSpawn[] | null;
};

/**
 * What staff have created, preferring the answer that covers everything.
 *
 * Two reads in series rather than in parallel, which is the one place on these
 * pages that is worth it: the second only happens when the first found no
 * function to call, and after migration 7 is applied it never happens again.
 * Asking for both every time would spend a query forever to save a round trip
 * on a page that is regenerated once every five minutes.
 */
export async function loadSpawnRecord(
  days: number = ECONOMY_WIDEST_WINDOW.days,
): Promise<SpawnRecord> {
  const [total, all] = await Promise.all([
    read("staff spawn total", publicStaffSpawnTotalStatement(), parseStaffSpawnTotal),
    read("staff spawns, all", publicStaffSpawnsAllStatement(), parseStaffSpawns),
  ]);

  if (total.status === "ok" && all.status === "ok") {
    return { total: total.data, spawns: all.data };
  }

  // Migration 7 has not been applied yet, so neither function exists. Fall back
  // to the windowed read the page has always had — and the page says ninety
  // days, because ninety days is all this saw.
  const windowed = await read(
    "staff spawns",
    publicStaffSpawnsStatement(days),
    parseStaffSpawns,
  );

  return {
    total: total.status === "ok" ? total.data : null,
    spawns:
      all.status === "ok"
        ? all.data
        : windowed.status === "ok"
          ? windowed.data
          : null,
  };
}

export type EconomyOverview = {
  readonly window: EconomyWindow;
  readonly snapshots: readonly Snapshot[];
  /** One day of movement for the teaser, not the window's — see `EconomyOverview`. */
  readonly lastDay: readonly Flow[] | null;
  readonly spawns: SpawnRecord;
};

/**
 * The top of the census: the totals, the two charts, and the two claims.
 *
 * The flows read is fixed at one day however wide the window is, because the
 * teaser says "in the last 24 hours" and means it. `dailyFlows` only works out
 * a partial day when the read was truncated, so the newest day in a thirty-day
 * list is always printed as though it were a whole one — fine in a list, a lie
 * in a headline.
 *
 * Only the snapshots are the page. Everything else is a line on it.
 */
export async function loadEconomyOverview(
  window: EconomyWindow = ECONOMY_DEFAULT_WINDOW,
): Promise<Load<EconomyOverview>> {
  const [snapshots, lastDay, spawns] = await Promise.all([
    read("economy", publicEconomyStatement(window.days), parseSnapshots),
    read("economy flow, one day", publicEconomyFlowStatement(1), parseFlows),
    loadSpawnRecord(window.days),
  ]);

  if (snapshots.status !== "ok") return { status: "unavailable" };

  return {
    status: "ok",
    data: {
      window,
      snapshots: snapshots.data,
      lastDay: lastDay.status === "ok" ? lastDay.data : null,
      spawns,
    },
  };
}

type RangePair = readonly [string, GroupRange];

export type EconomyCatalogue = {
  readonly census: Census;
  readonly ranges: ReadonlyMap<string, GroupRange> | null;
};

/**
 * Every object in the game, and what a category's total did over a month.
 *
 * The census is **fatal** here, where it is soft everywhere else: on the
 * overview it is one block among several and the page stands without it, and
 * here it is the entire page. A catalogue with no catalogue on it is not a
 * degraded page, it is an empty one, and it should say so in the panel the rest
 * of the site uses for that.
 *
 * It is the one loader wrapped in `unstable_cache`, because it is the one page
 * that cannot be a cached *page*: `?q=` is a request-time API and reading it
 * opts the route into rendering per request. Without this, every search would
 * be two database round trips through a pool of two — including the group
 * ranges, which is the expensive read on these pages. With it, the searching is
 * repeated per request and the reading is not.
 *
 * The ranges are read at the default window and nowhere else. This page has no
 * window tabs — `public_economy_latest()` takes no window by design, because how
 * much iron ore exists has one answer whichever tab is open — so the low and
 * high lines have to name the window they came from rather than leave a reader
 * to assume. It is also the expensive read on these pages, and this is the only
 * one of the four that wants it.
 */
const readCatalogue = unstable_cache(
  async () => {
    const [census, ranges] = await Promise.all([
      read("economy census", publicEconomyLatestStatement(), parseCensus),
      read(
        "economy group range",
        publicEconomyGroupRangeStatement(
          ECONOMY_DEFAULT_WINDOW.days,
          groupIdMap(),
        ),
        parseGroupRanges,
      ),
    ]);

    return {
      census: census.status === "ok" ? census.data : null,
      // Pairs, not the Map. `unstable_cache` stores what it is given as JSON,
      // and a Map through `JSON.stringify` is `{}` — so a cached read would
      // hand back an empty range for every category, on every request after
      // the first, and each block would quietly drop its low and high line.
      ranges:
        ranges.status === "ok" ? ([...ranges.data.entries()] as RangePair[]) : null,
    };
  },
  ["economy-catalogue"],
  { revalidate: 300, tags: ["economy"] },
);

export async function loadEconomyCatalogue(): Promise<Load<EconomyCatalogue>> {
  const { census, ranges } = await readCatalogue();

  if (census === null) return { status: "unavailable" };

  return {
    status: "ok",
    data: { census, ranges: ranges === null ? null : new Map(ranges) },
  };
}

export type EconomyChanges = {
  readonly window: EconomyWindow;
  readonly flows: readonly Flow[] | null;
};

/** What entered and left the game over the window: the rares, and only those. */
export async function loadEconomyChanges(
  window: EconomyWindow = ECONOMY_DEFAULT_WINDOW,
): Promise<Load<EconomyChanges>> {
  const flows = await read(
    "economy flow",
    publicEconomyFlowStatement(window.days),
    parseFlows,
  );

  return {
    status: "ok",
    data: { window, flows: flows.status === "ok" ? flows.data : null },
  };
}
