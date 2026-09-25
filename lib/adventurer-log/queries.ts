import type { Statement } from "@/lib/account/register";
import type { Look } from "@/lib/chathead/look";

/**
 * Every call into migration 13's Adventurer Log functions, and the parsing of
 * what they answer. The same discipline as the other `queries.ts` files:
 * statements are `{ text, values }` with nothing interpolated, and an answer
 * nobody documented throws instead of being guessed at. The viewer and the
 * author are always the verified session's username, or null for nobody.
 */

function asRecord(row: unknown, where: string): Record<string, unknown> {
  if (typeof row !== "object" || row === null) throw new Error(`${where}: not a row`);
  return row as Record<string, unknown>;
}

function asIso(value: unknown, where: string): string {
  const date =
    value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    throw new Error(`${where}: not a time: ${JSON.stringify(value)}`);
  }
  return date.toISOString();
}

function asInt(value: unknown, where: string): number {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  throw new Error(`${where}: not a whole number: ${JSON.stringify(value)}`);
}

function asText(value: unknown, where: string): string {
  if (typeof value === "string") return value;
  throw new Error(`${where}: not text: ${JSON.stringify(value)}`);
}

function oneOf<T extends string>(allowed: readonly T[], raw: unknown, where: string): T {
  if (typeof raw === "string" && (allowed as readonly string[]).includes(raw)) {
    return raw as T;
  }
  throw new Error(`${where} returned ${JSON.stringify(raw)}`);
}

function lookOf(row: Record<string, unknown>): Look | null {
  if (row.gender !== 0 && row.gender !== 1) return null;
  const arrays = [row.kits, row.colours, row.worn];
  const lengths = [7, 5, 14];
  if (
    !arrays.every(
      (value, i) =>
        Array.isArray(value) &&
        value.length === lengths[i] &&
        value.every((n) => Number.isInteger(n)),
    )
  ) {
    return null;
  }
  return {
    gender: row.gender,
    kits: row.kits as number[],
    colours: row.colours as number[],
    worn: row.worn as number[],
  };
}

// --- the header ---------------------------------------------------------------------

export type LogHeader =
  | { result: "not_found" | "banned" }
  | {
      result: "ok";
      username: string;
      joinedAt: string;
      headline: string;
      about: string;
      customCss: string;
      cssDisabled: boolean;
      hiddenCategories: number;
      isOwner: boolean;
      viewerBlocked: boolean;
      viewerCanPost: boolean;
      look: Look | null;
    };

export function logStatement(name: string, viewer: string | null): Statement {
  return {
    text: "select * from accounts.adventure_log($1, $2)",
    values: [name, viewer],
  };
}

export function parseLog(rows: readonly unknown[]): LogHeader {
  if (rows.length !== 1) throw new Error(`adventure_log returned ${rows.length} rows; always one`);
  const row = asRecord(rows[0], "adventure_log");
  const result = oneOf(["ok", "not_found", "banned"] as const, row.result, "adventure_log");
  if (result !== "ok") return { result };

  return {
    result,
    username: asText(row.username, "adventure_log username"),
    joinedAt: asIso(row.joined_at, "adventure_log joined_at"),
    headline: asText(row.headline, "adventure_log headline"),
    about: asText(row.about, "adventure_log about"),
    customCss: asText(row.custom_css, "adventure_log custom_css"),
    cssDisabled: row.css_disabled === true,
    hiddenCategories: asInt(row.hidden_categories, "adventure_log hidden_categories"),
    isOwner: row.is_owner === true,
    viewerBlocked: row.viewer_blocked === true,
    viewerCanPost: row.viewer_can_post === true,
    look: lookOf(row),
  };
}

// --- the timeline -------------------------------------------------------------------

export const TIMELINE_PAGE = 30;

export type Cursor = { at: string; rank: number; id: number };

export type TimelineRow =
  | { kind: "event"; rank: 0; id: number; at: string; category: number; body: string }
  | { kind: "update"; rank: 1; id: number; at: string; body: string; replyCount: number };

export function timelineStatement(
  name: string,
  viewer: string | null,
  before: Cursor | null,
  limit: number = TIMELINE_PAGE,
): Statement {
  return {
    text: "select * from accounts.adventure_timeline($1, $2, $3, $4, $5, $6)",
    values: [name, viewer, before?.at ?? null, before?.rank ?? null, before?.id ?? null, limit],
  };
}

/**
 * One page, and whether there is another: the function answers up to one
 * more row than asked for, which is the "more" and is not shown.
 */
export function parseTimeline(
  rows: readonly unknown[],
  limit: number = TIMELINE_PAGE,
): { rows: TimelineRow[]; more: boolean } {
  const parsed = rows.map((raw): TimelineRow => {
    const row = asRecord(raw, "adventure_timeline");
    const kind = oneOf(["event", "update"] as const, row.kind, "adventure_timeline kind");
    const id = asInt(row.id, "adventure_timeline id");
    const at = asIso(row.at, "adventure_timeline at");
    const body = asText(row.body, "adventure_timeline body");
    return kind === "event"
      ? { kind, rank: 0, id, at, category: asInt(row.category, "adventure_timeline category"), body }
      : { kind, rank: 1, id, at, body, replyCount: asInt(row.reply_count, "adventure_timeline reply_count") };
  });
  return { rows: parsed.slice(0, limit), more: parsed.length > limit };
}

export function cursorOf(row: TimelineRow): Cursor {
  return { at: row.at, rank: row.rank, id: row.id };
}

/** A cursor from `?at=&rank=&id=`, or null for the first page / a bad one. */
export function parseCursor(params: URLSearchParams): Cursor | null {
  const at = params.get("at");
  const rank = Number(params.get("rank"));
  const id = Number(params.get("id"));
  if (!at || Number.isNaN(Date.parse(at))) return null;
  if (rank !== 0 && rank !== 1) return null;
  if (!Number.isInteger(id) || id < 0) return null;
  return { at: new Date(at).toISOString(), rank, id };
}

// --- replies ------------------------------------------------------------------------

export type ReplyRow = {
  updateId: number;
  id: number;
  author: string;
  body: string;
  createdAt: string;
  canDelete: boolean;
};

export function repliesStatement(
  name: string,
  viewer: string | null,
  updateIds: readonly number[],
): Statement {
  return {
    text: "select * from accounts.adventure_replies($1, $2, $3::int[])",
    values: [name, viewer, updateIds.slice(0, 50)],
  };
}

export function parseReplies(rows: readonly unknown[]): ReplyRow[] {
  return rows.map((raw) => {
    const row = asRecord(raw, "adventure_replies");
    return {
      updateId: asInt(row.update_id, "adventure_replies update_id"),
      id: asInt(row.id, "adventure_replies id"),
      author: asText(row.author, "adventure_replies author"),
      body: asText(row.body, "adventure_replies body"),
      createdAt: asIso(row.created_at, "adventure_replies created_at"),
      canDelete: row.can_delete === true,
    };
  });
}

// --- the owner's text, filters and CSS ----------------------------------------------

export function logSaveStatement(username: string, headline: string, about: string): Statement {
  return {
    text: "select accounts.adventure_log_save($1, $2, $3) as result",
    values: [username, headline, about],
  };
}

export function setHiddenStatement(username: string, mask: number): Statement {
  return {
    text: "select accounts.adventure_log_set_hidden($1, $2) as result",
    values: [username, mask],
  };
}

/**
 * "About you" in one Save: the headline and about, then the kinds of
 * adventure the log hides. One statement, so one transaction - the second
 * function runs only when the first answered 'ok', and if either throws,
 * neither sticks. The route checks the text and the mask first, so the
 * second answering anything but 'ok' means the two sides disagree.
 */
export function aboutSaveStatement(
  username: string,
  headline: string,
  about: string,
  mask: number,
): Statement {
  return {
    text:
      "with saved as (select accounts.adventure_log_save($1, $2, $3) as result)" +
      " select saved.result as text_result," +
      " case when saved.result = 'ok' then accounts.adventure_log_set_hidden($1, $4) end as mask_result" +
      " from saved",
    values: [username, headline, about, mask],
  };
}

/** The first refusal of the two, or 'ok' when both saved. */
export function parseAboutSave(row: unknown): WriteResult {
  const record = asRecord(row, "about save");
  const text = parseWrite(record.text_result, "adventure_log_save");
  if (text !== "ok") return text;
  return parseWrite(record.mask_result, "adventure_log_set_hidden");
}

export function saveCssStatement(username: string, css: string): Statement {
  return {
    text: "select accounts.adventure_log_save_css($1, $2) as result",
    values: [username, css],
  };
}

// --- updates and replies ------------------------------------------------------------

export function updatePostStatement(username: string, body: string): Statement {
  return {
    text: "select * from accounts.adventure_update_post($1, $2)",
    values: [username, body],
  };
}

export function updateDeleteStatement(username: string, id: number): Statement {
  return {
    text: "select accounts.adventure_update_delete($1, $2) as result",
    values: [username, id],
  };
}

export function replyPostStatement(username: string, updateId: number, body: string): Statement {
  return {
    text: "select * from accounts.adventure_reply_post($1, $2, $3)",
    values: [username, updateId, body],
  };
}

export function replyDeleteStatement(username: string, id: number): Statement {
  return {
    text: "select accounts.adventure_reply_delete($1, $2) as result",
    values: [username, id],
  };
}

// --- blocks -------------------------------------------------------------------------

export function blockStatement(username: string, target: string): Statement {
  return { text: "select accounts.adventure_block($1, $2) as result", values: [username, target] };
}

export function unblockStatement(username: string, target: string): Statement {
  return { text: "select accounts.adventure_unblock($1, $2) as result", values: [username, target] };
}

export function blocksStatement(username: string): Statement {
  return { text: "select * from accounts.adventure_blocks($1)", values: [username] };
}

export function parseBlocks(rows: readonly unknown[]): { username: string; blockedAt: string }[] {
  return rows.map((raw) => {
    const row = asRecord(raw, "adventure_blocks");
    return {
      username: asText(row.username, "adventure_blocks username"),
      blockedAt: asIso(row.blocked_at, "adventure_blocks blocked_at"),
    };
  });
}

// --- reports ------------------------------------------------------------------------

export type ReportKind = "update" | "reply" | "log";

export function reportStatement(
  username: string,
  kind: ReportKind,
  targetId: number | null,
  logName: string | null,
  reason: string,
): Statement {
  return {
    text: "select accounts.adventure_report($1, $2, $3, $4, $5) as result",
    values: [username, kind, targetId, logName, reason],
  };
}

// --- answers ------------------------------------------------------------------------

/** Every answer a write can give, across the functions. */
export const WRITE_RESULTS = [
  "ok",
  "not_found",
  "banned",
  "muted",
  "blocked",
  "bad_headline",
  "bad_about",
  "bad_mask",
  "bad_body",
  "bad_kind",
  "bad_reason",
  "too_long",
  "css_disabled",
  "no_such_player",
  "self",
  "already",
  "rate_limited",
] as const;

export type WriteResult = (typeof WRITE_RESULTS)[number];

export function parseWrite(raw: unknown, where: string): WriteResult {
  return oneOf(WRITE_RESULTS, raw, where);
}

/** A post's answer: the result, and the new row's id when it is 'ok'. */
export function parsePost(
  rows: readonly unknown[],
  idColumn: "update_id" | "reply_id",
  where: string,
): { result: WriteResult; id: number | null } {
  const row = asRecord(rows[0], where);
  const result = parseWrite(row.result, where);
  return { result, id: result === "ok" ? asInt(row[idColumn], `${where} ${idColumn}`) : null };
}

/**
 * The shape of the request is 400; the account's state (banned, muted,
 * blocked, disabled) is 403; nothing there is 404; asked twice is 409; too
 * many is 429.
 */
export const LOG_STATUS: Record<string, number> = {
  ok: 200,
  bad_headline: 400,
  bad_about: 400,
  bad_mask: 400,
  bad_body: 400,
  bad_kind: 400,
  bad_reason: 400,
  too_long: 400,
  self: 400,
  banned: 403,
  muted: 403,
  blocked: 403,
  css_disabled: 403,
  not_found: 404,
  no_such_player: 404,
  already: 409,
  rate_limited: 429,
};

export function logStatusFor(result: string): number {
  return LOG_STATUS[result] ?? 500;
}
