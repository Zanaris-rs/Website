import type { Statement } from "@/lib/account/register";

/**
 * Every call into migration 8's record functions, and the parsing of what they
 * answer. The same discipline as `lib/invite/queries.ts`: statements are
 * `{ text, values }` with nothing interpolated, and a result string nobody
 * documented throws instead of being guessed at.
 *
 * The rules - logged out and settled, the window, the grace, the cap, what is
 * public - all live in SQL. The website passes the username from the verified
 * session and nothing else; every XP figure is read by the database itself.
 *
 * XP here is raw, the engine's x10 scale, exactly as the database stores it.
 * `lib/records/api.ts` turns it into what players see.
 */

function asRecord(row: unknown): Record<string, unknown> | null {
  return typeof row === "object" && row !== null
    ? (row as Record<string, unknown>)
    : null;
}

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

function asInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function oneOf<T extends string>(
  allowed: readonly T[],
  raw: unknown,
  where: string,
): T {
  if (typeof raw === "string" && (allowed as readonly string[]).includes(raw)) {
    return raw as T;
  }
  throw new Error(`${where} returned ${JSON.stringify(raw)}`);
}

function orNull<T extends string>(
  allowed: readonly T[],
  raw: unknown,
  where: string,
): T | null {
  return raw === null || raw === undefined ? null : oneOf(allowed, raw, where);
}

// --- the vocabulary ------------------------------------------------------------

export type RecordState = "running" | "valid" | "rejected" | "void" | "abandoned";

export const RECORD_STATES: readonly RecordState[] = [
  "running",
  "valid",
  "rejected",
  "void",
  "abandoned",
];

export type RecordReason =
  | "over_time"
  | "no_session"
  | "no_clean_logout"
  | "player"
  | "not_stopped";

export const RECORD_REASONS: readonly RecordReason[] = [
  "over_time",
  "no_session",
  "no_clean_logout",
  "player",
  "not_stopped",
];

/**
 * Where the player is, as far as a snapshot is concerned. `syncing` is logged
 * out less than five seconds ago, before the hiscore write that follows a
 * logout can be trusted to have landed. `never` is no clean logout on record.
 */
export type Presence = "logged_in" | "syncing" | "logged_out" | "never";

export const PRESENCES: readonly Presence[] = [
  "logged_in",
  "syncing",
  "logged_out",
  "never",
];

// --- start, stop, cancel ---------------------------------------------------------

export type StartResult =
  | "ok"
  | "not_found"
  | "unknown_duration"
  | "staff"
  | "banned"
  | "already_running"
  | "logged_in"
  | "syncing"
  | "no_hiscore"
  | "too_many";

export const START_RESULTS: readonly StartResult[] = [
  "ok",
  "not_found",
  "unknown_duration",
  "staff",
  "banned",
  "already_running",
  "logged_in",
  "syncing",
  "no_hiscore",
  "too_many",
];

export function recordStartStatement(username: string, seconds: number): Statement {
  return {
    text: "select * from accounts.record_start($1, $2)",
    values: [username, seconds],
  };
}

export function parseRecordStart(row: unknown): StartResult {
  return oneOf(START_RESULTS, asRecord(row)?.result, "accounts.record_start");
}

export type StopResult = "ok" | "not_found" | "not_running" | "logged_in" | "syncing";

export const STOP_RESULTS: readonly StopResult[] = [
  "ok",
  "not_found",
  "not_running",
  "logged_in",
  "syncing",
];

export type RecordStopped = {
  readonly result: StopResult;
  /** Set on `ok`: how the attempt closed. */
  readonly state: RecordState | null;
  readonly reason: RecordReason | null;
};

export function recordStopStatement(username: string): Statement {
  return { text: "select * from accounts.record_stop($1)", values: [username] };
}

export function parseRecordStop(row: unknown): RecordStopped {
  const record = asRecord(row);
  const result = oneOf(STOP_RESULTS, record?.result, "accounts.record_stop");
  if (result !== "ok") return { result, state: null, reason: null };

  return {
    result,
    state: oneOf(RECORD_STATES, record?.state, "accounts.record_stop state"),
    reason: orNull(RECORD_REASONS, record?.reason, "accounts.record_stop reason"),
  };
}

export type AbandonResult = "ok" | "not_found" | "not_running";

export function recordAbandonStatement(username: string): Statement {
  return {
    text: "select accounts.record_abandon($1) as result",
    values: [username],
  };
}

export function parseRecordAbandon(raw: unknown): AbandonResult {
  return oneOf(["ok", "not_found", "not_running"] as const, raw, "accounts.record_abandon");
}

// --- the player's own reads --------------------------------------------------------

export type RecordAttemptRow = {
  readonly id: number;
  readonly state: RecordState;
  readonly reason: RecordReason | null;
  readonly durationSeconds: number;
  /** From `record_durations()`, so the page never restates it. */
  readonly graceSeconds: number | null;
  readonly startedAt: string;
  readonly finalLogoutAt: string | null;
  readonly stoppedAt: string | null;
  readonly elapsedMs: number | null;
  /** Overall XP gained, raw. Null until Stop measured something. */
  readonly gainedValue: number | null;
  /** Where a valid attempt's Overall gain sits on its board right now. */
  readonly boardRank: number | null;
};

export type RecordCurrentRow = {
  readonly presence: Presence;
  readonly logoutTime: string | null;
  /** The database's clock, so the page counts down against ours. */
  readonly serverNow: string;
  /** The newest attempt, running or finished, or null if there has never been one. */
  readonly attempt: RecordAttemptRow | null;
};

export function recordCurrentStatement(username: string): Statement {
  return { text: "select * from accounts.record_current($1)", values: [username] };
}

/**
 * `accounts.record_current` answers every name with exactly one row, so a
 * missing row is a broken function or a broken read - never "no attempt" - and
 * it throws. That distinction is the whole reason the function is shaped the
 * way it is.
 */
export function parseRecordCurrent(rows: readonly unknown[]): RecordCurrentRow {
  if (rows.length !== 1) {
    throw new Error(`accounts.record_current returned ${rows.length} rows`);
  }

  const record = asRecord(rows[0]);
  const presence = oneOf(PRESENCES, record?.presence, "accounts.record_current presence");
  const serverNow = asIso(record?.server_now);
  if (!serverNow) throw new Error("accounts.record_current returned no server_now");

  const id = asInt(record?.attempt_id);
  if (id === null) {
    return { presence, logoutTime: asIso(record?.logout_time), serverNow, attempt: null };
  }

  const durationSeconds = asInt(record?.duration_seconds);
  const startedAt = asIso(record?.started_at);
  if (durationSeconds === null || !startedAt) {
    throw new Error("accounts.record_current returned an attempt without a window");
  }

  return {
    presence,
    logoutTime: asIso(record?.logout_time),
    serverNow,
    attempt: {
      id,
      state: oneOf(RECORD_STATES, record?.state, "accounts.record_current state"),
      reason: orNull(RECORD_REASONS, record?.reason, "accounts.record_current reason"),
      durationSeconds,
      graceSeconds: asInt(record?.grace_seconds),
      startedAt,
      finalLogoutAt: asIso(record?.final_logout_at),
      stoppedAt: asIso(record?.stopped_at),
      elapsedMs: asInt(record?.elapsed_ms),
      gainedValue: asInt(record?.gained),
      boardRank: asInt(record?.board_rank),
    },
  };
}

export type RecordHistoryRow = {
  readonly id: number;
  readonly state: RecordState;
  readonly reason: RecordReason | null;
  readonly durationSeconds: number;
  readonly startedAt: string;
  readonly elapsedMs: number | null;
  readonly gainedValue: number | null;
};

/** What the account page asks for. The function clamps to 1..50 either way. */
export const HISTORY_LIMIT = 20;

export function recordHistoryStatement(username: string, limit = HISTORY_LIMIT): Statement {
  return {
    text: "select * from accounts.record_history($1, $2)",
    values: [username, limit],
  };
}

export function parseRecordHistoryRow(row: unknown): RecordHistoryRow {
  const record = asRecord(row);
  const id = asInt(record?.attempt_id);
  const durationSeconds = asInt(record?.duration_seconds);
  const startedAt = asIso(record?.started_at);
  if (id === null || durationSeconds === null || !startedAt) {
    throw new Error("accounts.record_history returned a malformed row");
  }

  return {
    id,
    state: oneOf(RECORD_STATES, record?.state, "accounts.record_history state"),
    reason: orNull(RECORD_REASONS, record?.reason, "accounts.record_history reason"),
    durationSeconds,
    startedAt,
    elapsedMs: asInt(record?.elapsed_ms),
    gainedValue: asInt(record?.gained),
  };
}

export type RecordSkillRow = {
  /** The hiscore category: 0 is Overall, 1..21 the skills. */
  readonly category: number;
  readonly startValue: number;
  readonly endValue: number | null;
  readonly gainedValue: number | null;
};

export function recordAttemptSkillsStatement(username: string, attemptId: number): Statement {
  return {
    text: "select * from accounts.record_attempt_skills($1, $2)",
    values: [username, attemptId],
  };
}

export function parseRecordSkillRow(row: unknown): RecordSkillRow {
  const record = asRecord(row);
  const category = asInt(record?.category);
  const startValue = asInt(record?.start_xp);
  if (category === null || startValue === null) {
    throw new Error("accounts.record_attempt_skills returned a malformed row");
  }

  return {
    category,
    startValue,
    endValue: asInt(record?.end_xp),
    gainedValue: asInt(record?.gained),
  };
}

// --- the public board ------------------------------------------------------------

export type RecordBoardRow = {
  readonly rank: number;
  readonly username: string;
  readonly gainedValue: number;
  readonly elapsedMs: number;
  readonly achievedAt: string;
};

/** Rows on a board. The function clamps to 1..100 either way. */
export const BOARD_LIMIT = 50;

export function recordBoardStatement(
  seconds: number,
  category: number,
  limit = BOARD_LIMIT,
): Statement {
  return {
    text: "select * from accounts.record_board($1, $2, $3)",
    values: [seconds, category, limit],
  };
}

export function parseRecordBoardRow(row: unknown): RecordBoardRow {
  const record = asRecord(row);
  const rank = asInt(record?.rank);
  const username = record?.username;
  const gainedValue = asInt(record?.gained);
  const elapsedMs = asInt(record?.elapsed_ms);
  const achievedAt = asIso(record?.achieved_at);
  if (
    rank === null ||
    typeof username !== "string" ||
    username === "" ||
    gainedValue === null ||
    elapsedMs === null ||
    !achievedAt
  ) {
    throw new Error("accounts.record_board returned a malformed row");
  }

  return { rank, username, gainedValue, elapsedMs, achievedAt };
}

export type RecordDurationRow = {
  readonly seconds: number;
  readonly graceSeconds: number;
};

export function recordDurationsStatement(): Statement {
  return { text: "select * from accounts.record_durations()", values: [] };
}

export function parseRecordDurationRow(row: unknown): RecordDurationRow {
  const record = asRecord(row);
  const seconds = asInt(record?.duration_seconds);
  const graceSeconds = asInt(record?.grace_seconds);
  if (seconds === null || graceSeconds === null) {
    throw new Error("accounts.record_durations returned a malformed row");
  }
  return { seconds, graceSeconds };
}

// --- HTTP ---------------------------------------------------------------------

/**
 * One table for every record route. The refusals that are the player's to fix
 * - still in the game, a record already running - are 409, a conflict with the
 * account's own state; `staff` and `banned` are 403; the cap is 429.
 * `syncing` is 409 as well: the same request succeeds a few seconds later.
 */
export const RECORD_STATUS: Record<string, number> = {
  ok: 200,
  unknown_duration: 400,
  staff: 403,
  banned: 403,
  not_found: 404,
  already_running: 409,
  not_running: 409,
  logged_in: 409,
  syncing: 409,
  no_hiscore: 409,
  too_many: 429,
};

export function recordStatusFor(result: string): number {
  return RECORD_STATUS[result] ?? 500;
}
