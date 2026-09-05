import type { NextRequest } from "next/server";

import { hashPassword, hashPasswordWithSalt } from "@/lib/account/hash";
import { clientIp } from "@/lib/account/ip";
import {
  changePasswordStatement,
  parseLoginResult,
  parseSalt,
  passwordSaltStatement,
  reauthStatusFor,
} from "@/lib/account/login";
import { assertSameOrigin } from "@/lib/account/origin";
import { isBcryptSalt, saltOf, sessionVersion } from "@/lib/account/salt";
import { readSession, setSessionCookie } from "@/lib/account/session-server";
import {
  PASSWORD_MAX_TYPED,
  validatePassword,
} from "@/lib/account/validation";
import { isConfigured, query } from "@/lib/db";

/**
 * `POST /api/account/password` — change the password of the signed-in account.
 *
 * Two things make this safe against a stolen cookie:
 *
 * - **The current password is re-typed**, and it is checked by the database,
 *   not here. `accounts.change_password` is a compare-and-set: the `UPDATE`
 *   only matches while `password` still equals the candidate built from the
 *   current one. Whoever holds the cookie cannot change the password without
 *   knowing the password, so the account cannot be taken over from a session.
 * - **The same rate limiter** as login counts the failures, so a cookie thief
 *   cannot brute-force the current password through this endpoint either.
 *
 * On success the caller's own cookie is re-minted at the *new* salt: they stay
 * signed in, and every other device — whose cookie still carries the old salt
 * fingerprint — is bounced on its next authenticated page. That is the only
 * revocation a stateless session has, and it is the one that matters.
 *
 * The new password also has to satisfy the registration rules, because it is
 * the password the 2004 login screen will have to send.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

type Body = { currentPassword?: unknown; newPassword?: unknown };

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

  const session = await readSession();
  if (!session) return fail("session_expired", 401);

  if (!assertSameOrigin(request.headers)) {
    console.warn("[password] refused: cross-origin POST");
    return fail("origin", 403);
  }

  const currentPassword = asString(body.currentPassword);
  if (currentPassword.length < 1 || currentPassword.length > PASSWORD_MAX_TYPED) {
    return fail("bad_credentials", 403);
  }

  const next = validatePassword(asString(body.newPassword));
  if (!next.ok) return fail(next.error, 400);

  // Case is not kept, so `Hunter2` -> `hunter2` is not a change at all. Saying
  // so beats an "it worked" that changed nothing.
  if (currentPassword.toLowerCase() === next.value.toLowerCase()) {
    return fail("password_same", 400);
  }

  if (!isConfigured()) return fail("unavailable", 503);

  try {
    const saltStatement = passwordSaltStatement(session.u);
    const saltRows = await query<{ salt: unknown }>(
      saltStatement.text,
      saltStatement.values,
    );
    const stored = parseSalt(saltRows[0]?.salt);

    // No salt means no account behind this cookie any more. There is nothing
    // to change, and nothing to say beyond "log in again".
    if (!isBcryptSalt(stored)) {
      console.warn("[password] no usable salt for the session's account");
      return fail("session_expired", 401);
    }

    const current = await hashPasswordWithSalt(currentPassword, stored);
    const newHash = await hashPassword(next.value);

    const statement = changePasswordStatement(
      session.u,
      current,
      newHash,
      clientIp(request.headers) ?? "",
    );
    const rows = await query<{ result: unknown }>(
      statement.text,
      statement.values,
    );
    const result = parseLoginResult(rows[0]?.result);

    if (result !== "ok") {
      console.warn(`[password] ${result}`);
      return fail(result, reauthStatusFor(result));
    }

    // Re-mint at the new salt. `hashPassword` generated it, so it is in the
    // hash we just stored; every other device's cookie now mismatches.
    const newSalt = saltOf(newHash);
    if (newSalt && !(await setSessionCookie(session.u, sessionVersion(newSalt)))) {
      return fail("unavailable", 503);
    }

    console.log("[password] ok");
    return Response.json({ ok: true }, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("[password] failed", error);
    return fail("unavailable", 503);
  }
}
