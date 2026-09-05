import type { Statement } from "@/lib/account/register";
import { parseThread } from "@/lib/messages/queries";
import type { Thread } from "@/lib/messages/queries";

/**
 * The five calls the staff half of the site makes.
 *
 * Same rules as `lib/messages/queries.ts` — text built here so the tests can
 * assert it, every value a placeholder, one statement per call — plus one that
 * is only true on this side: **the actor's staff level is re-read from the
 * database inside every one of these functions.** `accounts.is_staff(p_actor)`
 * is a `WHERE` clause in the three reads and an early `RETURN 'forbidden'` in
 * the two writes, so a forged or stale cookie cannot promote anybody and a
 * demoted moderator loses the inbox on their very next request.
 *
 * The pages check `accounts.profile(...).staffmodlevel >= 2` first and redirect
 * a non-staff reader to the login form, exactly as a signed-out one is
 * redirected. That check is a courtesy — it decides what somebody *sees* — and
 * the SQL is the authorisation. Both are load-bearing and neither is enough
 * alone: the page check without the SQL would be bypassable by calling the
 * route directly, and the SQL without the page check would show a moderator's
 * furniture to somebody who could not use it.
 */

export type { Statement };
export type { Thread };

/* --- the inbox --- */

/**
 * Which tickets the inbox lists. `accounts.staff_inbox(p_actor, p_status)`
 * matches `t.status = p_status`, with `'all'` meaning no filter.
 *
 * **Always pass one of these three explicitly.** The function's default is
 * `'open'`, but a default only applies to an argument that is *absent*: pass
 * SQL NULL and `t.status = NULL` is null for every row, so the inbox comes
 * back empty and looks like a quiet day rather than a bug. Anything not in
 * this list matches no status and does the same, which is why the parser below
 * falls back rather than passing a query string through.
 */
export const INBOX_STATUSES = ["open", "closed", "all"] as const;
export type InboxStatus = (typeof INBOX_STATUSES)[number];

export const DEFAULT_INBOX_STATUS: InboxStatus = "open";

/** `?status=` off the URL, or the default. Never returns null or a raw string. */
export function parseInboxStatus(raw: unknown): InboxStatus {
  return typeof raw === "string" &&
    (INBOX_STATUSES as readonly string[]).includes(raw)
    ? (raw as InboxStatus)
    : DEFAULT_INBOX_STATUS;
}

export function staffInboxStatement(
  actor: string,
  status: InboxStatus = DEFAULT_INBOX_STATUS,
): Statement {
  return {
    text: "select * from accounts.staff_inbox($1, $2)",
    values: [actor, status],
  };
}

export function staffThreadStatement(
  actor: string,
  ticketId: number,
): Statement {
  return {
    text: "select * from accounts.staff_thread($1, $2)",
    values: [actor, ticketId],
  };
}

/**
 * Reply, and optionally close.
 *
 * `p_close` is not a nicety: a closed ticket refuses a reply the same way
 * `ticket_reply` does for the player, *unless* this is true. Having the last
 * word on the way out — or re-closing one somebody reopened — is exactly the
 * case where staff still need to write.
 */
export function staffReplyStatement(
  actor: string,
  ticketId: number,
  body: string,
  close: boolean,
): Statement {
  return {
    text: "select accounts.staff_reply($1, $2, $3, $4) as result",
    values: [actor, ticketId, body, close],
  };
}

/**
 * Write into somebody else's inbox in a staff member's name — the one verb in
 * this API that does, and so the one that re-types a password.
 *
 * `p_actor_candidate_hash` is `bcrypt(lower(typed), actor's own salt)`, built
 * by the route with the same salt handshake the login form uses. The function
 * compares it against the actor's stored hash, so a leaked `website`
 * credential still cannot impersonate a moderator here, and every call that
 * gets through leaves a `staff_action` row behind.
 */
export function staffNoticeStatement(
  actor: string,
  actorCandidateHash: string,
  username: string,
  subject: string,
  body: string,
): Statement {
  return {
    text: "select accounts.staff_notice($1, $2, $3, $4, $5) as result",
    values: [actor, actorCandidateHash, username, subject, body],
  };
}

/**
 * A `since` from the query string, or `null` for "let the function decide".
 *
 * An unparseable date is `null` rather than an error: this is a staff tool
 * with a text box in it, and a typo should show the default week rather than a
 * 400 the reader has to decode.
 */
export function parseSince(raw: string | null | undefined): Date | null {
  if (typeof raw !== "string" || raw === "") return null;
  const when = new Date(raw);
  return Number.isNaN(when.getTime()) ? null : when;
}

/** `p_since` null means the last week, which the function decides, not this. */
export function staffReportsStatement(
  actor: string,
  since: Date | null = null,
): Statement {
  return {
    text: "select * from accounts.staff_reports($1, $2)",
    values: [actor, since],
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

export type InboxRow = {
  readonly id: number;
  /** The ticket owner. */
  readonly username: string;
  readonly kind: string;
  readonly subject: string;
  readonly status: string;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
  /** True when the newest message on the ticket is the player's. */
  readonly awaitingStaff: boolean;
};

export function parseInboxRow(row: unknown): InboxRow | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "number") return null;

  return {
    id: r.id,
    username: asString(r.username),
    kind: asString(r.kind),
    subject: asString(r.subject),
    status: asString(r.status),
    createdAt: asIso(r.created_at),
    updatedAt: asIso(r.updated_at),
    awaitingStaff: r.awaiting_staff === true,
  };
}

/**
 * `staff_thread` returns the same shape as `ticket_thread` plus the owner's
 * `username`, so the player's parser reads it unchanged. Reusing it is the
 * point: the two views must never disagree about what a thread looks like.
 */
export function parseStaffThread(rows: readonly unknown[]): Thread | null {
  return parseThread(rows);
}

export type ReportRow = {
  readonly id: number;
  readonly reportedAt: string | null;
  /** The world the reporter was on; `null` for a row written before Part 3. */
  readonly world: number | null;
  /** The reporter's username, or `""` when the row has no account behind it. */
  readonly reporter: string;
  readonly offender: string;
  /** The rule number, 0-11 as the client sends it. */
  readonly reason: number | null;
  /** The reporter's packed coordinate, or `null`. */
  readonly coord: number | null;
  readonly sessionUuid: string;
};

export function parseReportRow(row: unknown): ReportRow | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "number") return null;

  return {
    id: r.id,
    reportedAt: asIso(r.reported_at),
    world: typeof r.world === "number" ? r.world : null,
    reporter: asString(r.reporter),
    offender: asString(r.offender),
    reason: typeof r.reason === "number" ? r.reason : null,
    coord: typeof r.coord === "number" ? r.coord : null,
    sessionUuid: asString(r.session_uuid),
  };
}

/* --- results --- */

export type StaffReplyResult =
  | "ok"
  | "forbidden"
  | "not_found"
  | "closed"
  | "invalid";

export type StaffNoticeResult =
  | "ok"
  | "forbidden"
  | "bad_credentials"
  | "rate_limited"
  | "not_found"
  | "invalid";

const REPLY_RESULTS: ReadonlySet<string> = new Set([
  "ok",
  "forbidden",
  "not_found",
  "closed",
  "invalid",
]);

const NOTICE_RESULTS: ReadonlySet<string> = new Set([
  "ok",
  "forbidden",
  "bad_credentials",
  "rate_limited",
  "not_found",
  "invalid",
]);

export function parseStaffReplyResult(raw: unknown): StaffReplyResult {
  if (typeof raw === "string" && REPLY_RESULTS.has(raw)) {
    return raw as StaffReplyResult;
  }
  throw new Error(`accounts.staff_reply returned ${JSON.stringify(raw)}`);
}

export function parseStaffNoticeResult(raw: unknown): StaffNoticeResult {
  if (typeof raw === "string" && NOTICE_RESULTS.has(raw)) {
    return raw as StaffNoticeResult;
  }
  throw new Error(`accounts.staff_notice returned ${JSON.stringify(raw)}`);
}
