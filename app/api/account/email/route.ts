import type { NextRequest } from "next/server";

import { checkEmail } from "@/lib/account/email";
import { hashPasswordWithSalt } from "@/lib/account/hash";
import { clientIp } from "@/lib/account/ip";
import {
  changeEmailStatement,
  parseLoginResult,
  parseSalt,
  passwordSaltStatement,
  reauthStatusFor,
} from "@/lib/account/login";
import { assertSameOrigin } from "@/lib/account/origin";
import { isBcryptSalt } from "@/lib/account/salt";
import { readSession } from "@/lib/account/session-server";
import { PASSWORD_MAX_TYPED } from "@/lib/account/validation";
import { isConfigured, query } from "@/lib/db";

/**
 * `POST /api/account/email` — change the contact address.
 *
 * The same compare-and-set as the password route: the current password is
 * re-typed and checked in the database, so a stolen cookie cannot quietly
 * repoint the only address staff would use to reach the owner. The failures
 * are counted by the same limiter.
 *
 * The address itself goes through the register form's checks — format, the
 * disposable-domain blocklist, an MX lookup — and both forms are stored: the
 * address as typed, and the normalised de-duplication key. It is still never
 * verified and never emailed; the account centre says so on the page.
 *
 * The session is *not* re-minted: the salt has not moved, so every device
 * stays signed in. Only a password change bounces the others.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

type Body = { currentPassword?: unknown; email?: unknown };

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
    console.warn("[email] refused: cross-origin POST");
    return fail("origin", 403);
  }

  const currentPassword = asString(body.currentPassword);
  if (currentPassword.length < 1 || currentPassword.length > PASSWORD_MAX_TYPED) {
    return fail("bad_credentials", 403);
  }

  const email = await checkEmail(asString(body.email));
  if (!email.ok) return fail(email.error, 400);

  if (!isConfigured()) return fail("unavailable", 503);

  try {
    const saltStatement = passwordSaltStatement(session.u);
    const saltRows = await query<{ salt: unknown }>(
      saltStatement.text,
      saltStatement.values,
    );
    const stored = parseSalt(saltRows[0]?.salt);

    if (!isBcryptSalt(stored)) {
      console.warn("[email] no usable salt for the session's account");
      return fail("session_expired", 401);
    }

    const current = await hashPasswordWithSalt(currentPassword, stored);

    const statement = changeEmailStatement(
      session.u,
      current,
      email.value.email,
      email.value.normalized,
      clientIp(request.headers) ?? "",
    );
    const rows = await query<{ result: unknown }>(
      statement.text,
      statement.values,
    );
    const result = parseLoginResult(rows[0]?.result);

    if (result !== "ok") {
      console.warn(`[email] ${result}`);
      return fail(result, reauthStatusFor(result));
    }

    console.log("[email] ok");
    return Response.json(
      { ok: true, email: email.value.email },
      { status: 200, headers: NO_STORE },
    );
  } catch (error) {
    console.error("[email] failed", error);
    return fail("unavailable", 503);
  }
}
