import type { NextRequest } from "next/server";

import { hashPasswordWithSalt } from "@/lib/account/hash";
import { clientIp } from "@/lib/account/ip";
import {
  loginStatement,
  loginStatusFor,
  parseLoginResult,
  parseSalt,
  passwordSaltStatement,
} from "@/lib/account/login";
import { assertSameOrigin } from "@/lib/account/origin";
import { fakeSalt, isBcryptSalt, sessionVersion } from "@/lib/account/salt";
import {
  currentSessionSecret,
  setSessionCookie,
} from "@/lib/account/session-server";
import {
  TURNSTILE_LOGIN_ACTION,
  allowedHostnames,
  verifyTurnstile,
} from "@/lib/account/turnstile";
import {
  PASSWORD_MAX_TYPED,
  canonicalizeUsername,
} from "@/lib/account/validation";
import { isConfigured, query } from "@/lib/db";

/**
 * `POST /api/account/login` — the salt handshake, and the cookie it mints.
 *
 * The order is the security property, so it is worth stating:
 *
 *  1. **`SESSION_SECRET` first.** With no signing key there is no session to
 *     mint and no fake salt to compute, so this answers 503 before touching
 *     Turnstile or the database. Fail closed.
 *  2. **Origin.** `SameSite=Lax` already keeps the cookie off a cross-site
 *     POST; this makes the refusal explicit.
 *  3. **Turnstile, action `login`.** A token minted by the register widget is
 *     not a token for attempting a login, and the rate limiter is behind here.
 *  4. **Canonicalise the username** — *without* the reserved-name rule, or the
 *     staff accounts named `mod_*` could never sign in.
 *  5. **The handshake.** `accounts.password_salt` returns the stored salt, or
 *     NULL for a name with no account; NULL (and a stored hash too malformed
 *     to have a salt) takes `fakeSalt`, which is an HMAC of the name under
 *     `SESSION_SECRET`. Either way one bcrypt at cost 10 runs and the answer
 *     is the same `bad_credentials`, so this endpoint is not a username
 *     oracle — neither by its answer nor by its timing.
 *  6. **`accounts.login`** compares the candidate against the stored hash in
 *     the database. The site never receives a hash, and the rate limit
 *     (failures only: 10 per name, 20 per IP, 15 minutes) lives in there where
 *     the `website` role cannot read or reset it.
 *
 * A ban does not refuse a login here. That is deliberate: somebody who cannot
 * play is exactly who needs to reach the Message Centre.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

type Body = {
  username?: unknown;
  password?: unknown;
  turnstileToken?: unknown;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return fail("bad_request", 400);
  }

  const secret = currentSessionSecret();
  if (!secret) {
    console.error("[login] SESSION_SECRET is unset or too short; refusing");
    return fail("unavailable", 503);
  }

  if (!assertSameOrigin(request.headers)) {
    console.warn("[login] refused: cross-origin POST");
    return fail("origin", 403);
  }

  const ip = clientIp(request.headers);

  const passedTurnstile = await verifyTurnstile({
    token: asString(body.turnstileToken),
    secret: process.env.TURNSTILE_SECRET_KEY,
    remoteIp: ip,
    expectedAction: TURNSTILE_LOGIN_ACTION,
    allowedHostnames: allowedHostnames(process.env.ALLOWED_TURNSTILE_HOSTNAMES),
  });
  if (!passedTurnstile) {
    console.warn("[login] refused: turnstile");
    return fail("turnstile", 400);
  }

  const username = canonicalizeUsername(asString(body.username));
  if (!username.ok) return fail(username.error, 400);

  // Not `validatePassword`: the 8-20 rule is a *registration* rule, and an
  // account made before it existed may hold a shorter password that must still
  // open. Anything outside what the login screen can type is simply wrong,
  // and answering `bad_credentials` keeps this endpoint's replies uniform.
  const password = asString(body.password);
  if (password.length < 1 || password.length > PASSWORD_MAX_TYPED) {
    return fail("bad_credentials", 401);
  }

  if (!isConfigured()) {
    return fail("unavailable", 503);
  }

  try {
    const saltStatement = passwordSaltStatement(username.value);
    const saltRows = await query<{ salt: unknown }>(
      saltStatement.text,
      saltStatement.values,
    );
    const stored = parseSalt(saltRows[0]?.salt);

    if (stored !== null && !isBcryptSalt(stored)) {
      // A stored password that is not bcrypt — a hand-edited row, a migration
      // half-done. It cannot be logged into, and pretending the account does
      // not exist is both true enough and the uniform answer.
      console.error(
        `[login] stored password for a username is not bcrypt-shaped; treating as unknown`,
      );
    }

    const salt = isBcryptSalt(stored)
      ? stored
      : fakeSalt(secret, username.value);

    const candidate = await hashPasswordWithSalt(password, salt);

    const statement = loginStatement(username.value, candidate, ip ?? "");
    const rows = await query<{ result: unknown }>(
      statement.text,
      statement.values,
    );
    const result = parseLoginResult(rows[0]?.result);

    if (result !== "ok") {
      console.warn(`[login] ${result}`);
      return fail(result, loginStatusFor(result));
    }

    // `sv` fingerprints the salt that was just used, so changing the password
    // later invalidates every cookie minted before it.
    const minted = await setSessionCookie(
      username.value,
      sessionVersion(salt),
    );
    if (!minted) return fail("unavailable", 503);

    console.log("[login] ok");
    return Response.json(
      { ok: true, username: username.value },
      { status: 200, headers: NO_STORE },
    );
  } catch (error) {
    console.error("[login] failed", error);
    return fail("unavailable", 503);
  }
}
