import contract from "@/lib/account/message-centre-contract.json";

/**
 * The Message Centre's vocabulary: the kinds a message can be, the kinds a
 * ticket can be, the caps on what you can write, and the words the pages put
 * around all of it.
 *
 * **Every number here is read out of the contract fixture, not typed in.**
 * `lib/account/message-centre-contract.json` is a byte-for-byte copy of the
 * engine's `test/fixtures/message-centre-contract.json`, which is itself the
 * written-down version of what `3_message_centre/migration.sql` enforces. The
 * SQL is the authority — it will answer `invalid` for a 121-character subject
 * whatever this file says — so the only useful thing this side can do is
 * refuse *the same* inputs a moment earlier, with a sentence a player can act
 * on instead of a status code. Reading the caps rather than repeating them is
 * what keeps the two in step: a cap that moves in the migration moves here as
 * soon as the fixture is re-copied, and `lib/account/contract.test.ts` — which
 * writes every one of those numbers out by hand — turns that re-copy into a
 * failing test rather than a silent change.
 *
 * The dates are deliberately *not* re-implemented: `formatDay`/`formatWhen` in
 * `lib/account/profile.ts` already assemble a UTC, British-shaped date by hand
 * (and explain at length why not `toLocaleString`), and a second date format
 * on a neighbouring page would be a bug the day one of them was changed.
 */

export { formatDay, formatWhen } from "@/lib/account/profile";

/* --- the caps, from the fixture --- */

export const SUBJECT_MAX = contract.limits.subject;
export const BODY_MAX = contract.limits.body;
/** `accounts.ticket_open` counts a rolling day. */
export const TICKETS_PER_DAY = contract.limits.tickets_per_account_per_day;
/** `accounts.ticket_reply` counts the player's own messages in a rolling hour. */
export const REPLIES_PER_HOUR = contract.limits.ticket_replies_per_account_per_hour;
/** `accounts.staff_notice` counts one actor's `staff_action` rows in an hour. */
export const NOTICES_PER_HOUR = contract.limits.staff_notices_per_actor_per_hour;

/* --- kinds --- */

export type MessageKind = "welcome" | "notice" | "ban" | "mute" | "reply";
export type TicketKind = "bug" | "appeal" | "other";
export type TicketStatus = "open" | "closed";

/** The kind `accounts.staff_notice` writes. Nothing else on the site writes one. */
export const NOTICE_KIND: MessageKind = "notice";

export const MESSAGE_KINDS: readonly MessageKind[] = [
  "welcome",
  "notice",
  "ban",
  "mute",
  "reply",
];

export const TICKET_KINDS: readonly TicketKind[] = ["bug", "appeal", "other"];

export const TICKET_STATUSES: readonly TicketStatus[] = ["open", "closed"];

/**
 * What each kind is called on the page.
 *
 * A ban notice says "Ban" and not "Notice" because the list is read by
 * somebody who has just been stopped at the login screen and wants to find the
 * one row that explains it.
 */
const MESSAGE_KIND_LABELS: Record<MessageKind, string> = {
  welcome: "Welcome",
  notice: "Notice",
  ban: "Ban",
  mute: "Mute",
  reply: "Reply",
};

const TICKET_KIND_LABELS: Record<TicketKind, string> = {
  bug: "Bug report",
  appeal: "Ban appeal",
  other: "Something else",
};

/**
 * A kind the database has that this build does not know about is shown as
 * "Message" rather than as a raw identifier: a new kind added by a later
 * migration should read as slightly vague, not as a leak of a column value.
 */
export function messageKindLabel(kind: string): string {
  return MESSAGE_KIND_LABELS[kind as MessageKind] ?? "Message";
}

export function ticketKindLabel(kind: string): string {
  return TICKET_KIND_LABELS[kind as TicketKind] ?? "Ticket";
}

export function isTicketKind(value: unknown): value is TicketKind {
  return typeof value === "string" && TICKET_KINDS.includes(value as TicketKind);
}

/** "Open" / "Closed", capitalised for a table cell. */
export function ticketStatusLabel(status: string): string {
  return status === "closed" ? "Closed" : status === "open" ? "Open" : status;
}

/* --- what a player may type --- */

/**
 * Plain text, as the plan puts it, and this is the whole of what that means:
 * no C0 control characters except the two that are text — a newline and a tab.
 *
 * It is not an HTML filter and must not be mistaken for one. React escapes
 * everything it renders, so `<b>` in a ticket body is displayed as `<b>` and
 * is not dangerous; what *is* worth refusing is a body carrying NULs, escape
 * sequences or bidirectional overrides, which render as nothing at all or as
 * something other than what was typed, and which arrive from a script rather
 * than from a keyboard. `\r` is stripped rather than refused, because a
 * `<textarea>` submits CRLF and refusing that would refuse every real form.
 */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/** Line endings normalised to `\n`; nothing else is touched. */
export function normalizeText(raw: string): string {
  return raw.replace(/\r\n?/g, "\n");
}

export function isPlainText(value: string): boolean {
  return !CONTROL_CHARACTERS.test(value);
}

export type FieldError =
  | "subject_empty"
  | "subject_long"
  | "subject_charset"
  | "body_empty"
  | "body_long"
  | "body_charset";

export type Validated<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: FieldError };

/**
 * The subject, trimmed, checked against the fixture's cap.
 *
 * The trim matters: the SQL trims before it stores but measures `length()` on
 * what it was *given*, so a subject of 118 characters padded to 130 with
 * spaces is `invalid` there and would be a mystery here. Trimming first means
 * the two always agree.
 */
export function validateSubject(raw: string): Validated<string> {
  const value = normalizeText(raw).trim();
  if (value.length === 0) return { ok: false, error: "subject_empty" };
  if (value.length > SUBJECT_MAX) return { ok: false, error: "subject_long" };
  if (!isPlainText(value)) return { ok: false, error: "subject_charset" };
  return { ok: true, value };
}

export function validateBody(raw: string): Validated<string> {
  const value = normalizeText(raw).trim();
  if (value.length === 0) return { ok: false, error: "body_empty" };
  if (value.length > BODY_MAX) return { ok: false, error: "body_long" };
  if (!isPlainText(value)) return { ok: false, error: "body_charset" };
  return { ok: true, value };
}

/**
 * One sentence per error code, shared by the routes' JSON and the forms'
 * error line so the two can never disagree about what went wrong.
 */
export const FIELD_MESSAGES: Record<FieldError, string> = {
  subject_empty: "Give the message a subject.",
  subject_long: `A subject can be at most ${SUBJECT_MAX} characters.`,
  subject_charset: "A subject must be plain text.",
  body_empty: "Write a message.",
  body_long: `A message can be at most ${BODY_MAX} characters.`,
  body_charset: "A message must be plain text.",
};

/* --- list furniture --- */

/**
 * `accounts.messages` already returns `left(body, 160)` as the preview, so
 * this only has to keep it on one line and say when it was cut. Newlines
 * become spaces: a preview that wrapped would break the list's rhythm.
 */
export const PREVIEW_MAX = 160;

export function previewLine(preview: string): string {
  const flat = normalizeText(preview).replace(/\s+/g, " ").trim();
  return flat.length >= PREVIEW_MAX ? `${flat.slice(0, PREVIEW_MAX - 1)}…` : flat;
}

/** "3 unread messages" / "1 unread message" / "" — the Account Centre's line. */
export function unreadLabel(unread: number): string {
  if (unread <= 0) return "";
  return unread === 1 ? "1 unread message" : `${unread} unread messages`;
}
