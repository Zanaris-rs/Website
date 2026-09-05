import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  SESSION_COOKIE,
  type Session,
  clearedSessionCookieOptions,
  newSession,
  sessionCookieOptions,
  sessionSecret,
  signSession,
  verifySession,
} from "./session";

/**
 * The session as the server sees it: the four functions that touch `cookies()`.
 *
 * Kept apart from `session.ts` so that everything in there stays pure and
 * testable under vitest — this half needs a request, and there is no renderer
 * in this repo's test setup. `import "server-only"` makes a stray client
 * import a build error rather than a bundled `SESSION_SECRET`.
 *
 * `secure` is decided by `NODE_ENV` rather than by sniffing the request. On
 * Vercel every request is HTTPS, and a `Secure` cookie over `http://localhost`
 * is simply not stored — which reads as "login silently does nothing".
 */

/** Production is always HTTPS; `npm run dev` never is. */
function secureCookies(): boolean {
  return process.env.NODE_ENV === "production";
}

export function currentSessionSecret(): string | null {
  return sessionSecret(process.env.SESSION_SECRET);
}

/**
 * Who this request is, or `null`.
 *
 * `null` covers every failure the same way — no cookie, a forged one, an
 * expired one, and `SESSION_SECRET` unset. That last one is the fail-closed
 * rule: with no signing key nothing can be verified, so nobody is signed in.
 */
export async function readSession(): Promise<Session | null> {
  const secret = currentSessionSecret();
  if (!secret) return null;

  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value, secret);
}

/**
 * The same, but a page that needs a session gets sent to the login form.
 *
 * `redirect()` throws a control-flow exception that Next catches, so it must
 * never be called inside a `try` block that swallows errors — the redirect
 * would be caught as a failure and the page would render signed-in-looking
 * markup to somebody who is not signed in. That is why the call sits here, at
 * the top of the page, and not inside the block that queries the database.
 */
export async function requireSession(): Promise<Session> {
  const session = await readSession();
  if (!session) redirect("/account/login");
  return session;
}

/**
 * Mint a cookie for `username` at the given salt fingerprint.
 *
 * Only reachable from a route handler: HTTP cannot set a cookie once a page
 * has started streaming, so the login and change-password routes are the only
 * callers. Returns `false` when there is no secret, which is the caller's cue
 * to answer 503 rather than to pretend the login worked.
 */
export async function setSessionCookie(
  username: string,
  saltVersion: string,
): Promise<boolean> {
  const secret = currentSessionSecret();
  if (!secret) return false;

  const store = await cookies();
  store.set(
    SESSION_COOKIE,
    signSession(newSession(username, saltVersion), secret),
    sessionCookieOptions(secureCookies()),
  );
  return true;
}

/**
 * Drop the cookie.
 *
 * An explicit `Max-Age=0` with the same attributes rather than `.delete()`,
 * so the `Secure`/`SameSite`/`Path` triple matches the cookie being replaced
 * exactly. This only clears *this* browser's copy — a stateless session cannot
 * be revoked server-side, which is what the seven-day cap is for.
 */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", clearedSessionCookieOptions(secureCookies()));
}
