import "server-only";

import { unstable_cache } from "next/cache";

import { isConfigured, query } from "@/lib/db";

import {
  BANS_PAGE_SIZE,
  type Census,
  ECONOMY_DEFAULT_WINDOW,
  type EconomyWindow,
  type Flow,
  type PunishmentPage,
  type Snapshot,
  type StaffSpawn,
  parseCensus,
  parseFlows,
  parsePunishmentPage,
  parseSnapshots,
  parseStaffSpawns,
  publicEconomyFlowStatement,
  publicEconomyLatestStatement,
  publicEconomyStatement,
  publicPunishmentsStatement,
  ECONOMY_WIDEST_WINDOW,
  publicStaffSpawnTotalStatement,
  publicStaffSpawnsAllStatement,
  publicStaffSpawnsStatement,
  parseStaffSpawnTotal,
} from "./queries";
import type { SpawnRecord } from "./spawns";

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
type SpawnRead = {
  /** Whether the caller renders the log, or only the figure over it. */
  readonly rows?: boolean;
  readonly days?: number;
};

/**
 * What staff have created, preferring the answer that covers everything.
 *
 * `rows` is whether the caller needs the log itself or only the figure. The
 * overview prints one number and `/economy/about` prints the list, and asking
 * for rows nobody renders is a connection out of a pool of two — which during
 * a build, with five census pages prerendering at once, is the difference
 * between a read and a connection timeout.
 *
 * The aggregate and the rows are separate functions over one table, so this
 * reads both and reports what came back rather than assuming they agree. The
 * windowed read is the last resort and costs a third connection, so it only
 * happens when neither all-time read covered the table.
 */
export async function loadSpawnRecord(
  { rows = false, days = ECONOMY_WIDEST_WINDOW.days }: SpawnRead = {},
): Promise<SpawnRecord> {
  const [aggregate, all] = await Promise.all([
    read("staff spawn total", publicStaffSpawnTotalStatement(), parseStaffSpawnTotal),
    rows
      ? read("staff spawns, all", publicStaffSpawnsAllStatement(), parseStaffSpawns)
      : Promise.resolve({ status: "unavailable" } as Load<StaffSpawn[]>),
  ]);

  // `parseStaffSpawnTotal` answers `null` for no rows, and no rows is not an
  // empty table. The function aggregates, so an empty table is one row of
  // zeroes — the contract the whole feature rests on. No row at all means the
  // read did not happen, and it must not become the nought it looks like.
  const total = aggregate.status === "ok" ? aggregate.data : null;
  const everything = all.status === "ok" ? all.data : null;

  // Everything the caller asked for, and all of it all-time.
  if (total !== null && (!rows || everything !== null)) {
    return { total, spawns: everything, allTime: everything !== null };
  }

  // One of the two is missing. Losing the rows still leaves the aggregate's
  // figure; losing the aggregate still leaves every row, which is the same
  // table and so still "ever". Either way there is nothing for a window to add.
  if (everything !== null) {
    return { total, spawns: everything, allTime: true };
  }

  // Neither covered the table, so fall back to the windowed read the page has
  // always had — and say ninety days, because ninety days is all this saw.
  const windowed = await read(
    "staff spawns",
    publicStaffSpawnsStatement(days),
    parseStaffSpawns,
  );

  return {
    total,
    spawns: windowed.status === "ok" ? windowed.data : null,
    allTime: false,
  };
}

export type EconomyOverview = {
  readonly window: EconomyWindow;
  readonly snapshots: readonly Snapshot[];
  /** The newest census, for the handful of categories the overview shows. */
  readonly census: Census | null;
  readonly spawns: SpawnRecord;
};

/**
 * The top of the census: the totals, the two charts, and the two claims.
 *
 * The census is soft here and fatal on `/economy/items`: half a dozen
 * categories are a block on this page and they *are* that one.
 *
 * The spawn claim is read over the widest window the SQL allows and not over
 * the one the tabs are set to: it is a statement about the whole record, and
 * the window tabs move the charts, not the promise.
 *
 * Only the snapshots are the page. Everything else is a line on it.
 */
export async function loadEconomyOverview(
  window: EconomyWindow = ECONOMY_DEFAULT_WINDOW,
): Promise<Load<EconomyOverview>> {
  const [snapshots, census, spawns] = await Promise.all([
    read("economy", publicEconomyStatement(window.days), parseSnapshots),
    read("economy census", publicEconomyLatestStatement(), parseCensus),
    // Not `window.days`. "Items ever created by staff" is a claim about the
    // whole history, and a claim that shrank to a week because the reader
    // clicked the 7-day tab would be a different claim wearing the same words.
    loadSpawnRecord(),
  ]);

  if (snapshots.status !== "ok") return { status: "unavailable" };

  return {
    status: "ok",
    data: {
      window,
      snapshots: snapshots.data,
      census: census.status === "ok" ? census.data : null,
      spawns,
    },
  };
}

export type EconomyCatalogue = {
  readonly census: Census;
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
 * This page has no window tabs: `public_economy_latest()` takes no window by
 * design, because how much iron ore exists has one answer whichever tab is
 * open.
 */
const readCatalogue = unstable_cache(
  async () => {
    // The group ranges used to be read here for a low-and-high line under each
    // category. Nothing renders one now — it reported a range over a window
    // the page could not draw — so the read is gone with it. It was the
    // expensive one: a hash join over up to 2,400 snapshots against every id
    // in the game, for two numbers.
    const census = await read(
      "economy census",
      publicEconomyLatestStatement(),
      parseCensus,
    );

    return { census: census.status === "ok" ? census.data : null };
  },
  ["economy-catalogue"],
  { revalidate: 300, tags: ["economy"] },
);

export async function loadEconomyCatalogue(): Promise<Load<EconomyCatalogue>> {
  const { census } = await readCatalogue();

  if (census === null) return { status: "unavailable" };

  return { status: "ok", data: { census } };
}

export type EconomyChanges = {
  readonly window: EconomyWindow;
  readonly flows: readonly Flow[] | null;
  /**
   * The last day on its own, not sliced out of the window above.
   *
   * `dailyFlows` groups by calendar day and only works a partial day out when
   * the read was truncated, so the newest day in a thirty-day list is printed
   * as though it were a whole one. That is fine in a list and wrong as a
   * heading, and "the last 24 hours" has to mean the last 24 hours.
   */
  readonly lastDay: readonly Flow[] | null;
};

/** What entered and left the game over the window: the rares, and only those. */
export async function loadEconomyChanges(
  window: EconomyWindow = ECONOMY_DEFAULT_WINDOW,
): Promise<Load<EconomyChanges>> {
  const [flows, lastDay] = await Promise.all([
    read("economy flow", publicEconomyFlowStatement(window.days), parseFlows),
    // One read, not a slice of the other, and skipped when the window already
    // *is* one day: the 24-hour tab would otherwise ask the same question
    // twice and print the answer twice.
    window.days === 1
      ? Promise.resolve({ status: "unavailable" } as Load<Flow[]>)
      : read("economy flow, one day", publicEconomyFlowStatement(1), parseFlows),
  ]);

  return {
    status: "ok",
    data: {
      window,
      flows: flows.status === "ok" ? flows.data : null,
      lastDay: lastDay.status === "ok" ? lastDay.data : null,
    },
  };
}
