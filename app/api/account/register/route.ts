import type { NextRequest } from "next/server";

import { agentHash } from "@/lib/account/agent";
import { checkEmail } from "@/lib/account/email";
import { hashPassword } from "@/lib/account/hash";
import { clientIp, ipGroup } from "@/lib/account/ip";
import {
  parseRegisterResult,
  registerStatement,
  statusFor,
} from "@/lib/account/register";
import { verifyTurnstile } from "@/lib/account/turnstile";
import { validatePassword, validateUsername } from "@/lib/account/validation";
import { isConfigured, query } from "@/lib/db";

/**
 * `POST /api/account/register` — the only way to create an account.
 *
 * bcrypt and `pg` are Node libraries, so this runs on the Node runtime, and
 * nothing here may ever be cached.
 *
 * Order matters and is deliberate:
 *
 *   1. **Turnstile, first and fail-closed.** With no email verification this
 *      is the load-bearing half of the gate. It runs before anything touches
 *      the database, so a scripted client cannot use this endpoint to probe
 *      which usernames are taken.
 *   2. Cheap local validation of the username and password.
 *   3. Email normalisation, blocklist, then the MX lookup (a network hop, so
 *      last of the checks).
 *   4. bcrypt, then one call to `accounts.register`, which enforces the rate
 *      caps and inserts the account atomically.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

type Body = {
  username?: unknown;
  password?: unknown;
  email?: unknown;
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

  const ip = clientIp(request.headers);

  // 1. Turnstile. A missing secret, a missing token, a siteverify error and a
  //    `success: false` are all the same answer: no.
  const passedTurnstile = await verifyTurnstile({
    token: asString(body.turnstileToken),
    secret: process.env.TURNSTILE_SECRET_KEY,
    remoteIp: ip,
  });
  if (!passedTurnstile) {
    return fail("turnstile", 400);
  }

  // 2. Username and password.
  const username = validateUsername(asString(body.username));
  if (!username.ok) return fail(username.error, 400);

  const password = validatePassword(asString(body.password));
  if (!password.ok) return fail(password.error, 400);

  // 3. Email: metadata, not identity, but it should at least be deliverable.
  const email = await checkEmail(asString(body.email));
  if (!email.ok) return fail(email.error, 400);

  if (!isConfigured()) {
    return fail("unavailable", 503);
  }

  try {
    // 4. Hash, then hand everything to the one function the `website` role can
    //    execute. The plaintext password never leaves this scope.
    const passwordHash = await hashPassword(password.value);

    const statement = registerStatement({
      username: username.value,
      email: email.value.email,
      emailNormalized: email.value.normalized,
      passwordHash,
      ip: ip ?? "",
      ipGroup: ip ? ipGroup(ip) : "",
      agentHash: agentHash(request.headers.get("user-agent")),
    });

    const rows = await query<{ result: unknown }>(
      statement.text,
      statement.values,
    );
    const result = parseRegisterResult(rows[0]?.result);

    if (result !== "ok") {
      return fail(result, statusFor(result));
    }

    return Response.json(
      { ok: true, username: username.value },
      { status: 200, headers: NO_STORE },
    );
  } catch (error) {
    console.error("registration failed", error);
    return fail("unavailable", 503);
  }
}
