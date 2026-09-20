import type { Statement } from "@/lib/account/register";

/**
 * The four calls the public half of the transparency work makes, and the
 * parsers that turn their rows into something a page can render.
 *
 * Same rules as `lib/hiscores/queries.ts` and `lib/staff/queries.ts`: the SQL
 * text is built here so `queries.test.ts` can assert it without a database,
 * every value is a placeholder, and there is no statement name anywhere
 * (Supabase's transaction pooler cannot keep a prepared statement between
 * queries, and `lib/db.ts` refuses to pass one).
 *
 * One rule is particular to this file. **Every statement is one line, and
 * every one of them is in this module.** The functions themselves live in the
 * engine repo's `4_evidence_and_records` migration and are being written in
 * parallel with these pages; keeping the four calls together means a signature
 * that moves — an argument added, a name changed — moves in one place, with
 * one test to update, and no page to touch.
 *
 * What these functions are is as important as what they return: they are
 * `SECURITY DEFINER` reads over tables the `website` role has no grant on, and
 * they select only the columns that are meant to be public. In particular
 * `public_punishments` never returns the account id of the moderator who
 * issued a punishment, or their name, and there is no argument here that could
 * ask for one — the decision that a punishment is public and its issuer is not
 * is enforced in the database, and this file could not defeat it if it tried.
 */

export type { Statement };

/* --- /bans --- */

/**
 * How many punishments a page of /bans shows.
 *
 * Twenty is the news list's page and about a screen of table. The record is
 * permanent, so this number decides how deep the paging goes forever; it is
 * read by both the page and the statement below so the two cannot disagree.
 */
export const BANS_PAGE_SIZE = 20;

/**
 * One page of the permanent record, newest first.
 *
 * The limit is `size + 1` on purpose. `public_punishments` has no count and
 * needs none: asking for one row more than the page shows is how the page
 * learns whether there is a next one, for the cost of a row rather than a
 * second scan of a table that only ever grows. `parsePunishmentPage` drops the
 * extra.
 */
export function publicPunishmentsStatement(
  page: number,
  size: number = BANS_PAGE_SIZE,
): Statement {
  const n = Number.isInteger(page) && page > 0 ? page : 1;
  return {
    text: "select * from accounts.public_punishments($1, $2)",
    values: [size + 1, (n - 1) * size],
  };
}

/* --- /economy --- */

/**
 * The windows /economy can be read over, in the order the tabs print them.
 *
 * Thirty days of hourly snapshots is 720 rows and about 20 KB over the wire,
 * which is a chart's worth of shape without being a download; ninety is the
 * ceiling `public_economy` clamps to, and the ceiling exists so that a tab
 * cannot ask for a year. Every read on the page uses the same window, so the
 * charts, the low and high lines, what entered and left, and what staff created
 * are all talking about the same stretch of time.
 *
 * The slug is the URL segment. `/economy` *is* the default window - there is no
 * `/economy/30-days` - which is `bansHref`'s rule and the news list's.
 */
export type EconomyWindow = {
  readonly slug: string;
  readonly days: number;
  /** For a heading: "the last 7 days". */
  readonly label: string;
  /** For a tab: "7 days". */
  readonly short: string;
};

export const ECONOMY_WINDOWS: readonly EconomyWindow[] = [
  { slug: "24-hours", days: 1, label: "the last 24 hours", short: "24 hours" },
  { slug: "7-days", days: 7, label: "the last 7 days", short: "7 days" },
  { slug: "30-days", days: 30, label: "the last 30 days", short: "30 days" },
  { slug: "90-days", days: 90, label: "the last 90 days", short: "90 days" },
];

export const ECONOMY_DEFAULT_WINDOW: EconomyWindow = ECONOMY_WINDOWS[2];

/** The window a slug names, or `null` - which the route turns into a 404. */
export function economyWindow(slug: string): EconomyWindow | null {
  return ECONOMY_WINDOWS.find((window) => window.slug === slug) ?? null;
}

/** Derived, so the default tab and the number the page prints cannot drift apart. */
export const ECONOMY_DAYS = ECONOMY_DEFAULT_WINDOW.days;

/** The snapshots themselves: totals, plus the tracked items, hourly. */
export function publicEconomyStatement(days: number = ECONOMY_DAYS): Statement {
  return {
    text: "select * from accounts.public_economy($1)",
    values: [days],
  };
}

/**
 * The ceiling `public_economy_flow` returns at, mirrored from the migration.
 *
 * The function is `ORDER BY taken_at DESC ... LIMIT 5000`, so a busy month
 * comes back with the *oldest* rows missing and nothing to say it happened.
 * Exactly this many rows means "at least this many exist", and `dailyFlows`
 * turns that into a sentence on the page rather than a quietly short list.
 * A number that drifts from the migration makes the page claim to be complete
 * when it is not, so it belongs next to the statement that provokes it.
 */
export const ECONOMY_FLOW_ROW_LIMIT = 5000;

/** What entered or left the game, per tracked item, per census. */
export function publicEconomyFlowStatement(
  days: number = ECONOMY_DAYS,
): Statement {
  return {
    text: "select * from accounts.public_economy_flow($1)",
    values: [days],
  };
}

/** Items staff created with `::give` and friends. No names, by decision. */
export function publicStaffSpawnsStatement(
  days: number = ECONOMY_DAYS,
): Statement {
  return {
    text: "select * from accounts.public_staff_spawns($1)",
    values: [days],
  };
}

/**
 * The ceiling `public_staff_spawns` returns at, mirrored from migration 4.
 *
 * `ECONOMY_FLOW_ROW_LIMIT`'s reason: the function is `ORDER BY created_at DESC
 * ... LIMIT 500`, so a five-hundred-and-first row is dropped with nothing to
 * say it happened. It has never mattered — the table is empty — and a limit
 * that only matters on the day it is breached is exactly the one to write down
 * before then.
 *
 * It applies to the *windowed* read only. `public_staff_spawns_all` has no
 * limit and needs none; see below.
 */
export const ECONOMY_SPAWN_ROW_LIMIT = 500;

/**
 * The ceiling `public_economy` returns at, mirrored from migration 4.
 *
 * Ninety days of hourly censuses is 2,160 rows, so there are 240 to spare. A
 * fifth window, or a census that ran more often than hourly, would silently
 * lose the oldest hours off the widest chart — `queries.test.ts` fails first.
 */
export const ECONOMY_SNAPSHOT_ROW_LIMIT = 2400;

/**
 * Every staff spawn there has ever been, and the aggregate over the same rows.
 *
 * Both are unwindowed and unlimited, which is safe for one reason: this table
 * should be empty. Only `notifyStaffSpawn` writes to it, only on a production
 * world, and a row in it is a thing that ought to be looked at rather than
 * summarised. Nothing reaps it either — `accounts.reap()` does not name it —
 * and that is deliberate, because a record of items conjured into the economy
 * that expires after ninety days is not a record.
 *
 * The windowed `public_staff_spawns` clamps its argument to ninety days, so it
 * cannot answer "ever" however large a number it is passed. That is what these
 * are for, and why the page falls back to ninety days and *says* ninety days
 * until they exist.
 */
export function publicStaffSpawnsAllStatement(): Statement {
  return { text: "select * from accounts.public_staff_spawns_all()", values: [] };
}

export function publicStaffSpawnTotalStatement(): Statement {
  return { text: "select * from accounts.public_staff_spawn_total()", values: [] };
}

/**
 * The newest census, whole - `items` included, which `public_economy` does not
 * return.
 *
 * No window argument. "How much iron ore exists" has one answer whichever tab
 * is open; only the low and high lines move, so all four windows read this same
 * row and the page has one place to be wrong about "now".
 */
export function publicEconomyLatestStatement(): Statement {
  return {
    text: "select * from accounts.public_economy_latest()",
    values: [],
  };
}

/**
 * The low and the high of each category's total across the window.
 *
 * The categories come from `lib/items/groups.ts` and are sent as an argument,
 * because a taxonomy for a public page is a presentation decision and not a
 * fact about the game - see that file, and migration 5.
 *
 * Stringified here rather than left to `pg`'s object coercion: the driver would
 * do the same thing, but doing it here is what keeps "no argument reaches the
 * statement text" a property this file's own test can check.
 */
export function publicEconomyGroupRangeStatement(
  days: number,
  groups: Record<string, readonly number[]>,
): Statement {
  return {
    text: "select * from accounts.public_economy_group_range($1, $2)",
    values: [days, JSON.stringify(groups)],
  };
}

/* --- rows --- */

function asIso(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "string" && value !== "") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * A count out of Postgres.
 *
 * `coins` is a `bigint`. `lib/db.ts` registers an `int8` parser that returns a
 * number, so this normally sees one — but a column that gains a `::numeric`
 * cast, or a `jsonb` value that came through as a string, would arrive as
 * text, and a total silently rendering as `NaN` is worse than one rendering as
 * zero. Anything that is not a finite number is `null`, which the pages show
 * as "not counted yet" rather than as a figure.
 */
function asCount(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export type PunishmentKind = "ban" | "mute";

export type Punishment = {
  /** The account's login name, as the hiscores spell it. */
  readonly username: string;
  readonly kind: PunishmentKind;
  readonly issuedAt: string | null;
  /** `null` is permanent — the engine writes no end date for one. */
  readonly until: string | null;
  /** True when the world issued it without a moderator (the anti-macro checks). */
  readonly automated: boolean;
  /** The optional one-line public note, or `""`. */
  readonly note: string;
  /** Set when a moderator reversed it; the row stays on the record either way. */
  readonly liftedAt: string | null;
};

const KINDS: ReadonlySet<string> = new Set(["ban", "mute"]);

/**
 * One row of the record, or `null` for one this build does not understand.
 *
 * A row with no username or an unknown `kind` is dropped rather than rendered
 * as a blank line: this is a page about named accounts, and half a row on it
 * would read as a punishment handed to nobody.
 */
export function parsePunishment(row: unknown): Punishment | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;

  const username = asString(r.username);
  const kind = asString(r.kind);
  if (username === "" || !KINDS.has(kind)) return null;

  return {
    username,
    kind: kind as PunishmentKind,
    issuedAt: asIso(r.issued_at),
    until: asIso(r.until),
    automated: r.automated === true,
    note: asString(r.note),
    liftedAt: asIso(r.lifted_at),
  };
}

export type PunishmentPage = {
  readonly items: readonly Punishment[];
  /**
   * How many rows the function returned, before the extra one was dropped and
   * before anything was parsed.
   *
   * `/bans/page/[n]` needs this and not `items.length`: a page past the end of
   * the record is a 404, but a page whose rows this build could not read is
   * not — it is a page with a shape problem, and answering "no such page"
   * would hide it.
   */
  readonly rowCount: number;
  /** 1-based. */
  readonly page: number;
  readonly prevPage: number | null;
  readonly nextPage: number | null;
};

/**
 * The rows of one page, and whether there is another.
 *
 * The statement asked for `size + 1`; a full extra row means a next page
 * exists. Rows this build cannot parse are dropped *after* that decision, so a
 * single unreadable row cannot make the next page's arrow disappear.
 */
export function parsePunishmentPage(
  rows: readonly unknown[],
  page: number,
  size: number = BANS_PAGE_SIZE,
): PunishmentPage {
  const n = Number.isInteger(page) && page > 0 ? page : 1;
  const hasNext = rows.length > size;
  const items = rows
    .slice(0, size)
    .map(parsePunishment)
    .filter((row): row is Punishment => row !== null);

  return {
    items,
    rowCount: rows.length,
    page: n,
    prevPage: n > 1 ? n - 1 : null,
    nextPage: hasNext ? n + 1 : null,
  };
}

/** One tracked item in a snapshot: how many of it existed at that hour. */
export type TrackedItem = {
  readonly id: number;
  readonly count: number;
};

export type Snapshot = {
  readonly takenAt: string | null;
  /** Accounts with a save file, not accounts registered. */
  readonly players: number | null;
  /** Item 995, summed across every permanent inventory in every save. */
  readonly coins: number | null;
  readonly tracked: readonly TrackedItem[];
};

/**
 * `tracked` as it arrives from `jsonb`.
 *
 * `pg` parses a `jsonb` column for us, so this is usually already an object.
 * The census writes `{id: count}`; the array-of-pairs form is accepted too
 * because the census tool and this page were written in parallel and a column
 * that turns out to be a list should show a table rather than an empty one. A
 * string is parsed once, for the same reason.
 */
function parseTracked(value: unknown): TrackedItem[] {
  let source = value;
  if (typeof source === "string") {
    try {
      source = JSON.parse(source);
    } catch {
      return [];
    }
  }

  const items: TrackedItem[] = [];

  if (Array.isArray(source)) {
    for (const entry of source) {
      if (typeof entry !== "object" || entry === null) continue;
      const e = entry as Record<string, unknown>;
      const id = asCount(e.id ?? e.item_id);
      const count = asCount(e.count);
      if (id === null || !Number.isInteger(id)) continue;
      items.push({ id, count: count ?? 0 });
    }
  } else if (typeof source === "object" && source !== null) {
    for (const [key, raw] of Object.entries(source)) {
      if (!/^\d+$/.test(key)) continue;
      const count = asCount(raw);
      items.push({ id: Number(key), count: count ?? 0 });
    }
  }

  // Most of a tracked item, first. The page's tracked table is short and the
  // rarest things on it are the interesting ones, so the order matters more
  // than jsonb key order, which is whatever Postgres felt like.
  return items.sort((a, b) => b.count - a.count || a.id - b.id);
}

export function parseSnapshot(row: unknown): Snapshot | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;

  const takenAt = asIso(r.taken_at);
  if (takenAt === null) return null;

  return {
    takenAt,
    players: asCount(r.players),
    coins: asCount(r.coins),
    tracked: parseTracked(r.tracked),
  };
}

/** Oldest first: a chart reads left to right, and so does a series. */
export function parseSnapshots(rows: readonly unknown[]): Snapshot[] {
  return rows
    .map(parseSnapshot)
    .filter((row): row is Snapshot => row !== null)
    .sort((a, b) => String(a.takenAt).localeCompare(String(b.takenAt)));
}

export type Flow = {
  readonly takenAt: string | null;
  readonly itemId: number;
  /** Positive entered the game, negative left it. Never zero: the census skips those. */
  readonly delta: number;
};

export function parseFlow(row: unknown): Flow | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;

  const itemId = asCount(r.item_id);
  const delta = asCount(r.delta);
  if (itemId === null || !Number.isInteger(itemId) || delta === null) {
    return null;
  }

  return { takenAt: asIso(r.taken_at), itemId, delta };
}

export function parseFlows(rows: readonly unknown[]): Flow[] {
  return rows.map(parseFlow).filter((row): row is Flow => row !== null);
}

export type StaffSpawn = {
  readonly createdAt: string | null;
  readonly itemId: number;
  readonly count: number;
  /** Which world it happened on, or `null` for a row written without one. */
  readonly world: number | null;
};

export function parseStaffSpawn(row: unknown): StaffSpawn | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;

  const itemId = asCount(r.item_id);
  if (itemId === null || !Number.isInteger(itemId)) return null;
  const world = asCount(r.world);

  return {
    createdAt: asIso(r.created_at),
    itemId,
    count: asCount(r.count) ?? 0,
    world: world === null ? null : world,
  };
}

/**
 * The whole `staff_spawn` table in four numbers.
 *
 * `spawns` is rows and `items` is how many objects those rows created, which
 * are different questions: one moderator handing out a thousand coins is one
 * spawn and a thousand items. `firstAt` is null on an empty table and is what
 * lets the page say *since when* it has been nought rather than just nought.
 */
export type StaffSpawnTotal = {
  readonly spawns: number;
  readonly items: number;
  readonly firstAt: string | null;
  readonly lastAt: string | null;
};

/**
 * The aggregate row, or `null` when there was not one.
 *
 * A table with nothing in it still returns a row, of zeroes and nulls — that is
 * the function's contract and it is the whole point of having it. No row at all
 * means the read did not happen, which the page must not print as "nought".
 */
export function parseStaffSpawnTotal(
  rows: readonly unknown[],
): StaffSpawnTotal | null {
  const row = rows[0];
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;

  const spawns = asCount(r.spawns);
  const items = asCount(r.items);
  if (spawns === null || items === null) return null;

  return {
    spawns,
    items,
    firstAt: asIso(r.first_at),
    lastAt: asIso(r.last_at),
  };
}

export function parseStaffSpawns(rows: readonly unknown[]): StaffSpawn[] {
  return rows
    .map(parseStaffSpawn)
    .filter((row): row is StaffSpawn => row !== null);
}

/**
 * The newest census: the totals plus every id in the game.
 *
 * `items` is the whole count and `tracked` is not on it - the function does not
 * return that column, because a page that has every id has no use for a subset
 * of it. Otherwise the same shape as `Snapshot`, and parsed with the same
 * `parseTracked`, since both columns are the same `{id: count}` jsonb.
 */
export type Census = {
  readonly takenAt: string | null;
  readonly players: number | null;
  readonly coins: number | null;
  readonly items: readonly TrackedItem[];
};

/**
 * The one row, or `null` when the census has not run.
 *
 * `null` is a page that says "the first census has not run yet", which is a
 * finished page. It is not an error, and `read()` must not turn it into one.
 */
export function parseCensus(rows: readonly unknown[]): Census | null {
  const row = rows[0];
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;

  const takenAt = asIso(r.taken_at);
  if (takenAt === null) return null;

  return {
    takenAt,
    players: asCount(r.players),
    coins: asCount(r.coins),
    items: parseTracked(r.items),
  };
}

/** What one category's total sank to and reached over the window. */
export type GroupRange = {
  readonly low: number;
  readonly high: number;
};

/**
 * The ranges by group key, including `"*"` for everything no group named.
 *
 * A row whose numbers will not parse is dropped rather than shown as zero: the
 * page renders a category with no range as one whose range is not known yet,
 * and a low of "0" that is really "unreadable" is the kind of wrong number this
 * whole page exists to not print.
 */
export function parseGroupRanges(
  rows: readonly unknown[],
): Map<string, GroupRange> {
  const ranges = new Map<string, GroupRange>();

  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;

    const key = asString(r.grp);
    const low = asCount(r.low);
    const high = asCount(r.high);
    if (key === "" || low === null || high === null) continue;

    ranges.set(key, { low, high });
  }

  return ranges;
}
