import type { Statement } from "@/lib/account/register";

/**
 * The seven calls the player's half of the Message Centre makes, and what
 * their answers mean.
 *
 * The same shape as `lib/account/login.ts`, for the same three reasons: the
 * SQL is built here so `queries.test.ts` can assert its exact text, every
 * value is a placeholder so nothing is ever interpolated, and each call is a
 * single statement because Supabase's transaction pooler gives no guarantee
 * that two statements from one request land on the same backend.
 *
 * **Every one of them is keyed by the username out of the signed session
 * cookie**, never by an id from the URL. `accounts.message(p_username, p_id)`
 * resolves the name to an account id and then requires `m.account_id` to match
 * it, so passing somebody else's message id returns no rows rather than their
 * message; `accounts.ticket_thread` does the same for a ticket. That is the
 * whole authorisation model on this side and it lives in the database, not
 * here: a bug in this file cannot widen it.
 *
 * Two of the reads have a side effect, which is unusual enough to say out
 * loud: `message` and `ticket_thread` mark what they return as read. They are
 * still `GET`s, because opening a message *is* reading it and there is nothing
 * else for the page to do — but it does mean they must never be cached, which
 * is why every route that calls them sets `no-store`.
 */

export type { Statement };

/* --- statements --- */

/**
 * The contract count: `count(*) from account_message where account_id = $1
 * and read_at is null`, with the username resolved to an id first. The engine
 * counts exactly this for the client's welcome screen.
 */
export function unreadStatement(username: string): Statement {
  return {
    text: "select accounts.unread($1) as unread",
    values: [username],
  };
}

/** Unread first, then newest first, 200 at most. `preview` is `left(body, 160)`. */
export function messagesStatement(username: string): Statement {
  return {
    text: "select * from accounts.messages($1)",
    values: [username],
  };
}

/**
 * One message, with its body — and reading it is what marks it read.
 *
 * `read_at` comes back as it was *before* the call, so the page can still say
 * "new" the one time it is true.
 */
export function messageStatement(username: string, id: number): Statement {
  return {
    text: "select * from accounts.message($1, $2)",
    values: [username, id],
  };
}

export function ticketsStatement(username: string): Statement {
  return {
    text: "select * from accounts.tickets($1)",
    values: [username],
  };
}

/**
 * The whole thread in one call: the ticket's own columns are repeated on every
 * row, so the header is read off the first one. Opening it marks that ticket's
 * `reply` notices read.
 */
export function ticketThreadStatement(
  username: string,
  ticketId: number,
): Statement {
  return {
    text: "select * from accounts.ticket_thread($1, $2)",
    values: [username, ticketId],
  };
}

export function ticketOpenStatement(
  username: string,
  kind: string,
  subject: string,
  body: string,
): Statement {
  return {
    text: "select accounts.ticket_open($1, $2, $3, $4) as result",
    values: [username, kind, subject, body],
  };
}

export function ticketReplyStatement(
  username: string,
  ticketId: number,
  body: string,
): Statement {
  return {
    text: "select accounts.ticket_reply($1, $2, $3) as result",
    values: [username, ticketId, body],
  };
}

/* --- rows --- */

/**
 * `pg` hands back `timestamptz` as a `Date` and `int4` as a number. Everything
 * below turns those into the shapes a page can render without a second thought
 * — ISO strings and plain numbers — and turns anything unexpected into `null`
 * rather than `"Invalid Date"`. The same two helpers as
 * `lib/account/profile.ts`, and deliberately so: two parsers that disagreed
 * about what a missing date looks like would be a bug per page.
 */
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

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** A row of `accounts.messages`: enough for the list, no body. */
export type MessageSummary = {
  readonly id: number;
  /** The ticket this reply belongs to, or `null` for a standalone notice. */
  readonly ticketId: number | null;
  readonly kind: string;
  readonly subject: string;
  readonly createdAt: string | null;
  readonly readAt: string | null;
  readonly preview: string;
};

/** A row of `accounts.message`: the same, plus the body. */
export type MessageDetail = MessageSummary & { readonly body: string };

export type TicketSummary = {
  readonly id: number;
  readonly kind: string;
  readonly subject: string;
  readonly status: string;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
  /** Unread `reply` notices on this ticket — the number next to the row. */
  readonly unread: number;
};

export type ThreadMessage = {
  readonly id: number;
  readonly fromStaff: boolean;
  /** The author's username, or `""` when the account is gone. */
  readonly author: string;
  readonly body: string;
  readonly createdAt: string | null;
};

export type Thread = {
  readonly id: number;
  readonly kind: string;
  readonly subject: string;
  readonly status: string;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
  /** The ticket owner's username. Only the staff view knows it; `null` here. */
  readonly username: string | null;
  readonly messages: readonly ThreadMessage[];
};

/**
 * `null` for a row that is not a message — a row with no `id` is a shape this
 * build does not recognise, and a list is better one row short than showing a
 * blank one that cannot be opened.
 */
export function parseMessageSummary(row: unknown): MessageSummary | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "number") return null;

  return {
    id: r.id,
    ticketId: typeof r.ticket_id === "number" ? r.ticket_id : null,
    kind: asString(r.kind),
    subject: asString(r.subject),
    createdAt: asIso(r.created_at),
    readAt: asIso(r.read_at),
    preview: asString(r.preview),
  };
}

export function parseMessageDetail(row: unknown): MessageDetail | null {
  const summary = parseMessageSummary(row);
  if (!summary) return null;
  const r = row as Record<string, unknown>;
  // `accounts.message` has no `preview` column; the body is the preview.
  return { ...summary, preview: asString(r.body), body: asString(r.body) };
}

export function parseTicketSummary(row: unknown): TicketSummary | null {
  if (typeof row !== "object" || row === null) return null;
  const r = row as Record<string, unknown>;
  if (typeof r.id !== "number") return null;

  return {
    id: r.id,
    kind: asString(r.kind),
    subject: asString(r.subject),
    status: asString(r.status),
    createdAt: asIso(r.created_at),
    updatedAt: asIso(r.updated_at),
    unread: asNumber(r.unread),
  };
}

/**
 * The thread out of the rows `ticket_thread` (or `staff_thread`) returns.
 *
 * Both functions repeat the ticket's columns on every row and `LEFT JOIN` the
 * messages, so:
 *
 * - **no rows at all** means no such ticket *for this caller* — a ticket
 *   somebody else owns, or one that does not exist. The two are deliberately
 *   indistinguishable; the route answers 404 either way.
 * - **one row with a null `message_id`** means the ticket exists and has no
 *   messages, which cannot happen through `ticket_open` (it writes the first
 *   message in the same transaction) but is exactly what the `LEFT JOIN` is
 *   there for. The header renders; the list is empty.
 *
 * `username` is the ticket owner and only `staff_thread` returns it; it is
 * `null` in the player's own view, where the owner is the reader.
 */
export function parseThread(rows: readonly unknown[]): Thread | null {
  const first = rows[0];
  if (typeof first !== "object" || first === null) return null;
  const head = first as Record<string, unknown>;
  if (typeof head.ticket_id !== "number") return null;

  const messages: ThreadMessage[] = [];
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as Record<string, unknown>;
    if (typeof r.message_id !== "number") continue;
    messages.push({
      id: r.message_id,
      fromStaff: r.from_staff === true,
      author: asString(r.author),
      body: asString(r.body),
      createdAt: asIso(r.created_at),
    });
  }

  return {
    id: head.ticket_id,
    kind: asString(head.ticket_kind),
    subject: asString(head.ticket_subject),
    status: asString(head.ticket_status),
    createdAt: asIso(head.ticket_created_at),
    updatedAt: asIso(head.ticket_updated_at),
    username: typeof head.username === "string" ? head.username : null,
    messages,
  };
}

/**
 * A row id out of a URL segment.
 *
 * `null` for anything that is not a plain positive decimal integer, which the
 * routes turn into a 400 rather than passing on: the columns are `SERIAL`, so
 * `1e3`, `0x10`, ` 4 ` and `4.0` are all names for a row that could exist but
 * are not how anything on this site ever links to one. `Number()` would accept
 * every one of them, and `parseInt` would read `"4abc"` as 4.
 *
 * The upper bound is `int4`'s, and it is not decoration: `SERIAL` is an
 * `integer`, so `accounts.message($1, 2147483648)` is not a lookup that misses
 * — it is `22003 numeric_value_out_of_range` raised before the function body
 * runs, which this repo's routes would surface as a 503 `unavailable`. A row id
 * one past the end of the type is a row that cannot exist, and "not found" is
 * the honest answer.
 */
export const MAX_ROW_ID = 2147483647;

export function parseId(raw: string | undefined | null): number | null {
  if (typeof raw !== "string" || !/^[1-9][0-9]{0,9}$/.test(raw)) return null;
  const id = Number(raw);
  return id <= MAX_ROW_ID ? id : null;
}

/**
 * The unread count, clamped at zero.
 *
 * A count that failed to parse is `0` and not an error: this number decorates
 * a link, and an Account Centre that 503s because a decoration could not be
 * read would be a worse page than one whose link says nothing.
 */
export function parseUnread(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return 0;
  return Math.floor(raw);
}

/* --- results --- */

export type TicketOpenResult = "ok" | "rate_limited" | "invalid";
export type TicketReplyResult =
  | "ok"
  | "not_found"
  | "closed"
  | "rate_limited"
  | "invalid";

const OPEN_RESULTS: ReadonlySet<string> = new Set([
  "ok",
  "rate_limited",
  "invalid",
]);

const REPLY_RESULTS: ReadonlySet<string> = new Set([
  "ok",
  "not_found",
  "closed",
  "rate_limited",
  "invalid",
]);

/**
 * An unrecognised answer throws, exactly as `parseLoginResult` does. A
 * function that grew a new return value is a contract break the operator
 * should see as a 503; guessing at it would show every player a confident
 * wrong sentence.
 */
export function parseTicketOpenResult(raw: unknown): TicketOpenResult {
  if (typeof raw === "string" && OPEN_RESULTS.has(raw)) {
    return raw as TicketOpenResult;
  }
  throw new Error(`accounts.ticket_open returned ${JSON.stringify(raw)}`);
}

export function parseTicketReplyResult(raw: unknown): TicketReplyResult {
  if (typeof raw === "string" && REPLY_RESULTS.has(raw)) {
    return raw as TicketReplyResult;
  }
  throw new Error(`accounts.ticket_reply returned ${JSON.stringify(raw)}`);
}

/**
 * Every result string this API can produce, and the status it becomes.
 *
 * One table for the player's calls and the staff's, because the mapping is the
 * same verb by verb and two tables would eventually disagree:
 *
 * | result | status | why |
 * | --- | --- | --- |
 * | `ok` | 200 | |
 * | `invalid` | 400 | the body or subject broke a cap |
 * | `forbidden` | 403 | not staff; the page checks first, the parser still must |
 * | `bad_credentials` | 403 | the re-typed staff password was wrong — 401 would mean "log in", and they have |
 * | `not_found` | 404 | no such ticket, or not this caller's |
 * | `closed` | 409 | the ticket is closed: a conflict with its state, not a bad request |
 * | `rate_limited` | 429 | |
 */
export const RESULT_STATUS: Record<string, number> = {
  ok: 200,
  invalid: 400,
  forbidden: 403,
  bad_credentials: 403,
  not_found: 404,
  closed: 409,
  rate_limited: 429,
};

/** 500 for a result with no mapping, which `parse*Result` has already refused. */
export function statusFor(result: string): number {
  return RESULT_STATUS[result] ?? 500;
}
