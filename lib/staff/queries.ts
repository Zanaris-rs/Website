import type { Statement } from "@/lib/account/register";
import { parseThread } from "@/lib/messages/queries";
import type { Thread } from "@/lib/messages/queries";

/**
 * Every call the staff half of the site makes: the inbox, the reports list,
 * one report with its evidence, and the three verbs that write.
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
  /**
   * The world-generated evidence key. `""` for every row written before
   * migration 4, and shared by several rows when more than one player reported
   * the same offender inside one capture window.
   */
  readonly uuid: string;
  /** Whether any input chunk or chat line was captured for that uuid. */
  readonly hasEvidence: boolean;
  /** `null` while the report is open. */
  readonly resolution: Resolution | null;
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
    uuid: asString(r.uuid),
    hasEvidence: r.has_evidence === true,
    resolution: parseResolution(r.resolution),
  };
}

/* --- one report, and the evidence behind it --- */

/**
 * The five reads that make up `/staff/reports/<id>`.
 *
 * They are five calls rather than one because they have five different
 * lifetimes: the report row is permanent, the input chunks and the chat copy
 * live thirty days or until the report is dismissed, and the wealth events are
 * not evidence at all — they are `session_wealth` rows, kept seven days for
 * everybody, that the function happens to select by the offender's sessions
 * inside the report window. A page that failed to render because a week-old
 * report had lost its wealth rows would be worse than one that shows the rest.
 */
export function staffReportStatement(actor: string, id: number): Statement {
  return {
    text: "select * from accounts.staff_report($1, $2)",
    values: [actor, id],
  };
}

export function staffReportInputStatement(actor: string, id: number): Statement {
  return {
    text: "select * from accounts.staff_report_input($1, $2)",
    values: [actor, id],
  };
}

export function staffReportChatStatement(actor: string, id: number): Statement {
  return {
    text: "select * from accounts.staff_report_chat($1, $2)",
    values: [actor, id],
  };
}

export function staffReportWealthStatement(
  actor: string,
  id: number,
): Statement {
  return {
    text: "select * from accounts.staff_report_wealth($1, $2)",
    values: [actor, id],
  };
}

/**
 * The wealth search box: one player, the last seven days, or as far back as
 * `since` asks within them.
 *
 * `null` means "let the function decide", exactly as `staff_reports` does —
 * `session_wealth` is reaped at seven days, so a wider window is not a bigger
 * answer, it is the same answer with a misleading heading.
 */
export function staffWealthStatement(
  actor: string,
  username: string,
  since: Date | null = null,
): Statement {
  return {
    text: "select * from accounts.staff_wealth($1, $2, $3)",
    values: [actor, username, since],
  };
}

/**
 * Resolve a report — and, when the resolution is `dismissed`, delete its
 * evidence in the same statement.
 *
 * `p_candidate_hash` is second, for the same reason it is second in
 * `staff_notice`: this is the compare-and-set against the actor's own
 * password, and a shifted parameter would hand the hash to the function as the
 * report id. Deleting a macroer's mouse trail is not reversible, so it re-types
 * a password like every other verb that cannot be undone.
 */
export function staffReportResolveStatement(
  actor: string,
  actorCandidateHash: string,
  id: number,
  resolution: Resolution,
  note: string,
): Statement {
  return {
    text: "select accounts.staff_report_resolve($1, $2, $3, $4, $5) as result",
    values: [actor, actorCandidateHash, id, resolution, note],
  };
}

/**
 * Lift a ban or a mute: clears `account.banned_until` / `muted_until`, stamps
 * `punishment.lifted_at`, and leaves the punishment row in the public record
 * saying it was lifted. The row is never deleted — that is the point of a
 * permanent record — so this is the one call that edits history in public.
 */
export function staffLiftStatement(
  actor: string,
  actorCandidateHash: string,
  punishmentId: number,
  note: string,
): Statement {
  return {
    text: "select accounts.staff_lift($1, $2, $3, $4) as result",
    values: [actor, actorCandidateHash, punishmentId, note],
  };
}

/**
 * The one-line public note on a punishment. No password: it writes a sentence
 * onto a row that is already public and changes nobody's access to anything.
 */
export function staffPunishmentNoteStatement(
  actor: string,
  punishmentId: number,
  note: string,
): Statement {
  return {
    text: "select accounts.staff_punishment_note($1, $2, $3) as result",
    values: [actor, punishmentId, note],
  };
}

/* --- the rows those five reads answer with --- */

/** `actioned | dismissed | watch`, and nothing else. */
export const RESOLUTIONS = ["actioned", "dismissed", "watch"] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

export function isResolution(value: unknown): value is Resolution {
  return (
    typeof value === "string" &&
    (RESOLUTIONS as readonly string[]).includes(value)
  );
}

/** A resolution the database has that this build does not know is `null`. */
export function parseResolution(value: unknown): Resolution | null {
  return isResolution(value) ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asCount(value: unknown): number {
  const n = asNumber(value);
  return n === null ? 0 : Math.trunc(n);
}

/** `true`, `false`, or "the function could not tell". */
function asTriState(value: unknown): boolean | null {
  return value === true ? true : value === false ? false : null;
}

export type ReportDetail = {
  readonly id: number;
  readonly uuid: string;
  readonly reportedAt: string | null;
  readonly world: number | null;
  readonly reporter: string;
  readonly offender: string;
  readonly reason: number | null;
  readonly coord: number | null;
  readonly sessionUuid: string;
  /** False when the offender's name matched no account at all. */
  readonly offenderRegistered: boolean;
  readonly offenderBannedUntil: string | null;
  readonly offenderMutedUntil: string | null;
  /** The world the *offender* was on, when the report could resolve it. */
  readonly offenderWorld: number | null;
  /** The evidence window: thirty minutes before the report, fifteen after. */
  readonly windowFrom: string | null;
  readonly windowTo: string | null;
  readonly inputChunks: number;
  /**
   * Whether the offender and the reporter logged in from the same address.
   * No raw IP ever leaves the database; this boolean is the whole of it, and
   * `null` means the function had no login to compare.
   */
  readonly sameIpAsReporter: boolean | null;
  readonly offenderLogins24h: number | null;
  readonly resolvedAt: string | null;
  readonly resolution: Resolution | null;
  readonly resolvedBy: string;
  readonly staffNote: string;
  /**
   * The `punishment` rows behind a currently banned or muted offender, which
   * is what `staff_lift` needs. Null when the offender is not under one, or
   * when the punishment predates migration 4 and has no row.
   */
  readonly banPunishmentId: number | null;
  readonly mutePunishmentId: number | null;
};

export function parseReportDetail(row: unknown): ReportDetail | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "number") return null;

  return {
    id: r.id,
    uuid: asString(r.uuid),
    reportedAt: asIso(r.reported_at),
    world: asNumber(r.world),
    reporter: asString(r.reporter),
    offender: asString(r.offender),
    reason: asNumber(r.reason),
    coord: asNumber(r.coord),
    sessionUuid: asString(r.session_uuid),
    offenderRegistered: r.offender_registered === true,
    offenderBannedUntil: asIso(r.offender_banned_until),
    offenderMutedUntil: asIso(r.offender_muted_until),
    offenderWorld: asNumber(r.offender_world),
    windowFrom: asIso(r.window_from),
    windowTo: asIso(r.window_to),
    inputChunks: asCount(r.input_chunks),
    sameIpAsReporter: asTriState(r.same_ip_as_reporter),
    offenderLogins24h: asNumber(r.offender_logins_24h),
    resolvedAt: asIso(r.resolved_at),
    resolution: parseResolution(r.resolution),
    resolvedBy: asString(r.resolved_by),
    staffNote: asString(r.staff_note),
    banPunishmentId: asNumber(r.ban_punishment_id),
    mutePunishmentId: asNumber(r.mute_punishment_id),
  };
}

/**
 * One row of `report_input`: a chunk of the engine's own record framing, as
 * base64 because `bytea` over the wire is not worth the argument.
 *
 * `kind` is where the chunk came from — `ring` is what the world already had
 * in memory when the report landed, `live` is what came after it — and
 * `client` decides which signals mean anything: the Java client sends at most
 * one move record per packet, so a `java` stream has no usable cursor path.
 */
export type InputChunkRow = {
  readonly seq: number;
  readonly kind: string;
  readonly client: string;
  readonly startedAt: string | null;
  readonly flushedAt: string | null;
  /** base64; `lib/staff/macro/decode.ts` turns it into events. */
  readonly data: string;
};

export function parseInputChunkRow(row: unknown): InputChunkRow | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  const seq = asNumber(r.seq);
  if (seq === null) return null;

  return {
    seq,
    kind: asString(r.kind),
    client: asString(r.client),
    startedAt: asIso(r.started_at),
    flushedAt: asIso(r.flushed_at),
    data: asString(r.data_base64),
  };
}

/** A line of the offender's own chat, copied out before the hourly sweep. */
export type ChatRow = {
  readonly at: string | null;
  /** `public` or `private_sent`. */
  readonly kind: string;
  /** Who a private message went to; `""` on a public line. */
  readonly toUsername: string;
  readonly coord: number | null;
  readonly message: string;
  /**
   * How many lines the function found before its `LIMIT 2000` — a
   * `count(*) OVER ()`, so it is the same number on every row of the answer.
   *
   * It is on the row rather than beside the list because that is where the
   * function puts it: there is no second statement and no second count over a
   * table this one has already read. A talkative offender in a long window is
   * exactly the report where the page must not present the first two thousand
   * lines as all of them.
   */
  readonly total: number;
};

export function parseChatRow(row: unknown): ChatRow | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  const at = asIso(r.at);
  if (at === null) return null;

  return {
    at,
    kind: asString(r.kind),
    toUsername: asString(r.to_username),
    coord: asNumber(r.coord),
    message: asString(r.message),
    total: asCount(r.total),
  };
}

/**
 * How many lines there were, against how many came back.
 *
 * Zero rows is zero lines: the count rides on the rows, so an empty answer
 * carries no number and there is nothing to be short of. And a `total` the
 * function did not send reads as 0, which `Math.max` turns into "as many as
 * arrived" — a missing column must not make a complete page claim to be
 * partial.
 */
export function chatTotal(chat: readonly ChatRow[]): number {
  return Math.max(chat.length, chat[0]?.total ?? 0);
}

/**
 * One wealth event. `items` and `counterpartItems` are the engine's own JSON
 * (`[{id, name, count}]`), passed through as text: the site does not need to
 * understand an item list to show it, and parsing it here would invent a
 * second opinion about what an item is called.
 */
export type WealthRow = {
  readonly at: string | null;
  /** `WealthEventType` from the engine: 0 TRADE … 10 PARTY_ROOM. */
  readonly eventType: number | null;
  readonly coord: number | null;
  readonly items: string;
  readonly value: number | null;
  /** The other party's session uuid, when the event had one. */
  readonly counterpart: string;
  readonly counterpartItems: string;
  readonly counterpartValue: number | null;
};

export function parseWealthRow(row: unknown): WealthRow | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  const at = asIso(r.at);
  if (at === null) return null;

  return {
    at,
    eventType: asNumber(r.event_type),
    coord: asNumber(r.coord),
    items: asString(r.items),
    value: asNumber(r.value),
    counterpart: asString(r.counterpart),
    counterpartItems: asString(r.counterpart_items),
    counterpartValue: asNumber(r.counterpart_value),
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

/**
 * The two verbs that re-type a password answer with the same vocabulary
 * `staff_notice` does, for the same reasons: `bad_credentials` is a mistyped
 * password, `rate_limited` is too many of them in their own bucket, and
 * `forbidden` is an account that is not staff.
 */
export type StaffResolveResult = StaffNoticeResult;
export type StaffLiftResult = StaffNoticeResult;

/**
 * No password, so no `bad_credentials` — but it **is** limited, twenty per
 * actor per hour, and that is not the same limit as the password verbs'.
 *
 * Theirs counts wrong passwords; this one counts *notes*, because the note is
 * a line of text on a page anybody can read and the cost of writing one is
 * nothing. A rate limit is the only thing standing between a compromised
 * moderator account and a hundred sentences on `/bans`.
 *
 * `statusFor` already maps `rate_limited` to 429, so a route that calls this
 * gets the right status without saying so.
 */
export type StaffPunishmentNoteResult =
  | "ok"
  | "forbidden"
  | "rate_limited"
  | "not_found"
  | "invalid";

const NOTE_RESULTS: ReadonlySet<string> = new Set([
  "ok",
  "forbidden",
  "rate_limited",
  "not_found",
  "invalid",
]);

export function parseStaffResolveResult(raw: unknown): StaffResolveResult {
  if (typeof raw === "string" && NOTICE_RESULTS.has(raw)) {
    return raw as StaffResolveResult;
  }
  throw new Error(
    `accounts.staff_report_resolve returned ${JSON.stringify(raw)}`,
  );
}

export function parseStaffLiftResult(raw: unknown): StaffLiftResult {
  if (typeof raw === "string" && NOTICE_RESULTS.has(raw)) {
    return raw as StaffLiftResult;
  }
  throw new Error(`accounts.staff_lift returned ${JSON.stringify(raw)}`);
}

export function parseStaffPunishmentNoteResult(
  raw: unknown,
): StaffPunishmentNoteResult {
  if (typeof raw === "string" && NOTE_RESULTS.has(raw)) {
    return raw as StaffPunishmentNoteResult;
  }
  throw new Error(
    `accounts.staff_punishment_note returned ${JSON.stringify(raw)}`,
  );
}
