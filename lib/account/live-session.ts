/**
 * What a route answers when the cookie is no longer good.
 *
 * The decision itself lives in `lib/account/profile-server.ts` — a cookie is
 * live when `accounts.profile` still returns a row for its username and the
 * salt fingerprint in it still matches. This file is only the translation of
 * that verdict into an HTTP answer, and it is a separate, `server-only`-free
 * module so that the mapping can be unit-tested: `session-server.ts` imports
 * `next/headers` and cannot be loaded under vitest at all.
 *
 * Two answers, and the split matters to the page on the other end:
 *
 * - **401 `session_expired`** is "this cookie is finished" — no cookie, a
 *   forged or expired one, an account that has gone, or a password changed
 *   somewhere else. The message centre pages turn it into a bounce to the
 *   login form, and a stale cookie must never look like a working one.
 * - **503 `unavailable`** is "we could not tell" — no `DATABASE_URL`, or the
 *   read failed. Signing somebody out because Supabase blinked would be a
 *   worse answer than saying the site is unavailable, because it destroys a
 *   session that was perfectly good.
 *
 * The failure directions are deliberately different: an unreadable database
 * refuses the request (fail closed) but does not revoke the cookie.
 */

/** The ways the check ends other than "ok", named as their causes. */
export type LiveSessionVerdict =
  /** No cookie, a forged one, an expired one, or `SESSION_SECRET` unset. */
  | "no_cookie"
  /** The account is gone, or the salt has moved: a password changed. */
  | "signed_out"
  /** No database, or the read failed. Not a verdict about the cookie. */
  | "unavailable";

export type SessionRefusal = {
  readonly error: "session_expired" | "unavailable";
  readonly status: 401 | 503;
};

export const SESSION_EXPIRED: SessionRefusal = {
  error: "session_expired",
  status: 401,
};

export const SESSION_UNAVAILABLE: SessionRefusal = {
  error: "unavailable",
  status: 503,
};

/**
 * The verdict as a status and an error string.
 *
 * `no_cookie` and `signed_out` collapse into the same 401 on purpose. A caller
 * that could tell "you never had a session" from "your session was revoked"
 * would answer differently for a username that exists and one that does not,
 * and there is nothing the page could usefully do with the difference anyway:
 * both mean log in again.
 */
export function refusalFor(verdict: LiveSessionVerdict): SessionRefusal {
  return verdict === "unavailable" ? SESSION_UNAVAILABLE : SESSION_EXPIRED;
}
