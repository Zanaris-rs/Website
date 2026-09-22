import { isCategory, OVERALL } from "@/lib/hiscores/categories";
import { xpFromValue } from "@/lib/hiscores/format";

import { DEFAULT_DURATION, recordDuration } from "./durations";
import {
  PRESENCES,
  RECORD_REASONS,
  RECORD_STATES,
  type RecordBoardRow,
  type RecordCurrentRow,
} from "./queries";

/**
 * The JSON contracts between the record routes and the pages, in both
 * directions, as `lib/hiscores/api.ts` does it: the route shapes rows into a
 * response, and the client parses one coming back. A malformed body throws,
 * and the caller turns that into an "unavailable" state rather than rendering
 * junk.
 */

// --- GET /api/records/current -----------------------------------------------------

/**
 * The polled read is the parsed row itself - camelCased, ISO dates, XP still
 * raw - because only this site's own account page reads it, and the server
 * render hands the component the very same shape.
 */
export type RecordCurrentResponse = RecordCurrentRow;

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${where} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function member<T extends string>(allowed: readonly T[], value: unknown, where: string): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  throw new Error(`${where}: ${JSON.stringify(value)} is not one of ${allowed.join(", ")}`);
}

function integer(value: unknown, where: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${where} must be an integer`);
  }
  return value;
}

function integerOrNull(value: unknown, where: string): number | null {
  return value === null ? null : integer(value, where);
}

function iso(value: unknown, where: string): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new Error(`${where} must be an ISO date`);
  }
  return value;
}

function isoOrNull(value: unknown, where: string): string | null {
  return value === null ? null : iso(value, where);
}

export function parseRecordCurrentResponse(json: unknown): RecordCurrentResponse {
  const where = "records current";
  const body = asRecord(json, where);

  let attempt: RecordCurrentRow["attempt"] = null;
  if (body.attempt !== null) {
    const at = `${where}: attempt`;
    const raw = asRecord(body.attempt, at);
    attempt = {
      id: integer(raw.id, `${at}.id`),
      state: member(RECORD_STATES, raw.state, `${at}.state`),
      reason: raw.reason === null ? null : member(RECORD_REASONS, raw.reason, `${at}.reason`),
      durationSeconds: integer(raw.durationSeconds, `${at}.durationSeconds`),
      graceSeconds: integerOrNull(raw.graceSeconds, `${at}.graceSeconds`),
      startedAt: iso(raw.startedAt, `${at}.startedAt`),
      finalLogoutAt: isoOrNull(raw.finalLogoutAt, `${at}.finalLogoutAt`),
      stoppedAt: isoOrNull(raw.stoppedAt, `${at}.stoppedAt`),
      elapsedMs: integerOrNull(raw.elapsedMs, `${at}.elapsedMs`),
      gainedValue: integerOrNull(raw.gainedValue, `${at}.gainedValue`),
      boardRank: integerOrNull(raw.boardRank, `${at}.boardRank`),
    };
  }

  return {
    presence: member(PRESENCES, body.presence, `${where}: presence`),
    logoutTime: isoOrNull(body.logoutTime, `${where}: logoutTime`),
    serverNow: iso(body.serverNow, `${where}: serverNow`),
    attempt,
  };
}

// --- GET /api/records/board ------------------------------------------------------

export type BoardParams = {
  readonly durationSeconds: number;
  readonly category: number;
};

export type BoardParamError = "bad_category" | "bad_duration";

export type ParsedBoardParams =
  | { readonly ok: true; readonly value: BoardParams }
  | { readonly ok: false; readonly error: BoardParamError };

/** A `URLSearchParams`, or anything else that can answer `get`. */
type Query = { get(name: string): string | null };

function wholeNumber(raw: string): number | null {
  return /^\d{1,6}$/.test(raw) ? Number(raw) : null;
}

/** Pure and total, like the hiscores' parser: the route turns a failure into a 400. */
export function parseBoardParams(query: Query): ParsedBoardParams {
  const rawCategory = query.get("category");
  const category = rawCategory === null || rawCategory === "" ? OVERALL : wholeNumber(rawCategory);
  if (category === null || !isCategory(category)) {
    return { ok: false, error: "bad_category" };
  }

  const rawDuration = query.get("duration");
  const durationSeconds =
    rawDuration === null || rawDuration === "" ? DEFAULT_DURATION.seconds : wholeNumber(rawDuration);
  if (durationSeconds === null || recordDuration(durationSeconds) === null) {
    return { ok: false, error: "bad_duration" };
  }

  return { ok: true, value: { durationSeconds, category } };
}

/** The public board: a hiscores page, so it lives under them. */
export const BOARD_PATH = "/hiscores/records";

/** `/hiscores/records?category=9`. The default duration and Overall have no parameter of their own. */
export function boardHref(params: BoardParams): string {
  const search = new URLSearchParams();
  if (params.durationSeconds !== DEFAULT_DURATION.seconds) {
    search.set("duration", String(params.durationSeconds));
  }
  if (params.category !== OVERALL) {
    search.set("category", String(params.category));
  }
  const text = search.toString();
  return text === "" ? BOARD_PATH : `${BOARD_PATH}?${text}`;
}

export type BoardRow = {
  readonly rank: number;
  /** Stored form, e.g. `the_inducted`. Player links use this. */
  readonly username: string;
  /** Display form, e.g. `The Inducted`. */
  readonly name: string;
  /** XP gained, as players see it. */
  readonly xp: number;
  readonly elapsedMs: number;
  readonly achievedAt: string;
};

export type BoardResponse = {
  readonly durationSeconds: number;
  readonly category: number;
  readonly rows: readonly BoardRow[];
};

export function toBoardResponse(
  params: BoardParams,
  rows: readonly RecordBoardRow[],
  displayName: (username: string) => string,
): BoardResponse {
  return {
    durationSeconds: params.durationSeconds,
    category: params.category,
    rows: rows.map((row) => ({
      rank: row.rank,
      username: row.username,
      name: displayName(row.username),
      xp: xpFromValue(row.gainedValue),
      elapsedMs: row.elapsedMs,
      achievedAt: row.achievedAt,
    })),
  };
}

export function parseBoardResponse(json: unknown): BoardResponse {
  const where = "records board";
  const body = asRecord(json, where);
  if (!Array.isArray(body.rows)) throw new Error(`${where}: "rows" must be an array`);

  return {
    durationSeconds: integer(body.durationSeconds, `${where}: durationSeconds`),
    category: integer(body.category, `${where}: category`),
    rows: body.rows.map((raw, index) => {
      const at = `${where}: rows[${index}]`;
      const row = asRecord(raw, at);
      if (typeof row.username !== "string" || row.username === "") {
        throw new Error(`${at}.username must be a non-empty string`);
      }
      if (typeof row.name !== "string" || row.name === "") {
        throw new Error(`${at}.name must be a non-empty string`);
      }
      return {
        rank: integer(row.rank, `${at}.rank`),
        username: row.username,
        name: row.name,
        xp: integer(row.xp, `${at}.xp`),
        elapsedMs: integer(row.elapsedMs, `${at}.elapsedMs`),
        achievedAt: iso(row.achievedAt, `${at}.achievedAt`),
      };
    }),
  };
}

/**
 * The public board's cache policy, the hiscores' own: a record can be broken
 * every five minutes, so a minute of staleness is the most a reader should
 * see, and ten minutes of serve-while-revalidating keeps the pool quiet.
 */
export const BOARD_CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=600";
