/**
 * The Adventurer Log's text rules, the same numbers migration 13 checks
 * (`CHECK (length(...))`, `accounts.adventure_text`). The site refuses first,
 * with a sentence naming the field; the database is the authority.
 */

export const HEADLINE_MAX = 80;
export const ABOUT_MAX = 1000;
export const UPDATE_MAX = 2000;
export const REPLY_MAX = 500;
export const REASON_MAX = 500;
export const CSS_MAX = 20000;

/** How long everyone but the owner waits to see an adventure (migration 13). */
export const PUBLIC_DELAY_MINUTES = 20;

export type TextCheck = { ok: true; value: string } | { ok: false; error: string };

// Control characters other than tab and newline, which the database refuses.
const CONTROL = /[\u0001-\u0008\u000b-\u001f\u007f]/;

/**
 * Text as the database will store it: CRLF made LF, trimmed of spaces, tabs
 * and newlines at both ends, no control characters, within `max`, and not
 * empty unless `emptyOk`. `oneLine` refuses a newline (the headline).
 */
export function checkText(
  raw: unknown,
  field: string,
  max: number,
  options: { emptyOk?: boolean; oneLine?: boolean } = {},
): TextCheck {
  if (typeof raw !== "string") return { ok: false, error: `${field} must be text.` };
  const value = raw.replace(/\r\n/g, "\n").replace(/^[ \n\t]+|[ \n\t]+$/g, "");

  if (value.length === 0 && !options.emptyOk) {
    return { ok: false, error: `${field} cannot be empty.` };
  }
  if (value.length > max) {
    return { ok: false, error: `${field} can be at most ${max} characters.` };
  }
  if (CONTROL.test(value)) {
    return { ok: false, error: `${field} has a character in it that is not allowed.` };
  }
  if (options.oneLine && value.includes("\n")) {
    return { ok: false, error: `${field} must be one line.` };
  }
  return { ok: true, value };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "24 Sep 2026, 14:05" in UTC - game time. Deterministic, not "5 minutes
 * ago": a timeline renders on the server and hydrates in the browser, and a
 * relative time would differ between the two.
 */
export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${hh}:${mm}`;
}

/** "Sep 2026", for when a player joined. */
export function formatMonth(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
