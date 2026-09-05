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
 * How much of the census /economy shows.
 *
 * Thirty days of hourly snapshots is 720 rows and about 20 KB over the wire,
 * which is a chart's worth of shape without being a download. The flow rows
 * and the staff spawns use the same window so the three blocks on the page are
 * talking about the same month.
 */
export const ECONOMY_DAYS = 30;

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

export function parseStaffSpawns(rows: readonly unknown[]): StaffSpawn[] {
  return rows
    .map(parseStaffSpawn)
    .filter((row): row is StaffSpawn => row !== null);
}
