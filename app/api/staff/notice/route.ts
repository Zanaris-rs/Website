import type { NextRequest } from "next/server";

import { hashPasswordWithSalt } from "@/lib/account/hash";
import { parseSalt, passwordSaltStatement } from "@/lib/account/login";
import { assertSameOrigin } from "@/lib/account/origin";
import { isBcryptHash, isBcryptSalt } from "@/lib/account/salt";
import { readSession } from "@/lib/account/session-server";
import {
  PASSWORD_MAX_TYPED,
  canonicalizeUsername,
} from "@/lib/account/validation";
import { validateBody, validateSubject } from "@/lib/messages/format";
import { statusFor } from "@/lib/messages/queries";
import { parseStaffNoticeResult, staffNoticeStatement } from "@/lib/staff/queries";
import { loadStaff } from "@/lib/staff/staff-server";
import { isConfigured, query } from "@/lib/db";

/**
 * `POST /api/staff/notice` — write a notice into a player's Message Centre in
 * a staff member's name. `{ username, subject, body, password }`.
 *
 * This is the one verb in the whole API that writes into somebody else's inbox
 * under a moderator's name, so it is the one that **re-types a password**, and
 * the handshake is the same three steps as `/api/account/password`:
 *
 *  1. `accounts.password_salt(actor)` returns the actor's own 29-character
 *     bcrypt salt — public by design, and the site never sees a hash;
 *  2. `bcrypt(lower(typed), salt)` here produces the candidate;
 *  3. `accounts.staff_notice` compares it against the stored hash, and the
 *     compare is the authorisation. A leaked `website` credential still cannot
 *     impersonate a moderator, because it does not know the moderator's
 *     password.
 *
 * There is no fake-salt path, unlike the login route: the actor is the account
 * already signed in, so a missing salt is not an unknown username but a dead
 * session, and it says so.
 *
 * The failures the function counts are its own bucket, `notice:<actor>`, not
 * the actor's login bucket. Ten mistyped notices must not also lock a
 * moderator out of signing in — losing your own account because you fumbled a
 * password into a form you were already signed in to would be absurd.
 *
 * The recipient's name goes through `canonicalizeUsername`, not
 * `validateUsername`: `mod_*` and `admin` are reserved *for registration* and
 * are exactly the accounts a notice may need to reach.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

type Body = {
  username?: unknown;
  subject?: unknown;
  body?: unknown;
  password?: unknown;
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function POST(request: NextRequest) {
  let payload: Body;
  try {
    payload = (await request.json()) as Body;
  } catch {
    return fail("bad_request", 400);
  }

  const session = await readSession();
  if (!session) return fail("session_expired", 401);

  if (!assertSameOrigin(request.headers)) {
    console.warn("[staff] refused: cross-origin notice");
    return fail("origin", 403);
  }

  const staff = await loadStaff(session);
  if (staff.status === "unavailable") return fail("unavailable", 503);
  if (staff.status === "signed_out") return fail("session_expired", 401);
  if (staff.status === "forbidden") return fail("forbidden", 403);

  const recipient = canonicalizeUsername(asString(payload.username));
  if (!recipient.ok) return fail(recipient.error, 400);

  const subject = validateSubject(asString(payload.subject));
  if (!subject.ok) return fail(subject.error, 400);

  const text = validateBody(asString(payload.body));
  if (!text.ok) return fail(text.error, 400);

  const password = asString(payload.password);
  if (password.length < 1 || password.length > PASSWORD_MAX_TYPED) {
    return fail("bad_credentials", 403);
  }

  if (!isConfigured()) return fail("unavailable", 503);

  const actor = staff.profile.username;

  try {
    const saltStatement = passwordSaltStatement(actor);
    const saltRows = await query<{ salt: unknown }>(
      saltStatement.text,
      saltStatement.values,
    );
    const stored = parseSalt(saltRows[0]?.salt);

    // No salt for an account that answered `accounts.profile` a moment ago
    // means the account has gone between the two calls. There is nothing to
    // compare against and nothing to say beyond "log in again".
    if (!isBcryptSalt(stored)) {
      console.warn("[staff] no usable salt for the actor's account");
      return fail("session_expired", 401);
    }

    const candidate = await hashPasswordWithSalt(password, stored);

    // The function refuses anything that is not 60 characters, which would
    // come back as `bad_credentials` and read as a mistyped password. It would
    // not be: it would be this side broken, and it should say so.
    if (!isBcryptHash(candidate)) {
      console.error("[staff] computed candidate is not a bcrypt hash");
      return fail("unavailable", 503);
    }

    const statement = staffNoticeStatement(
      actor,
      candidate,
      recipient.value,
      subject.value,
      text.value,
    );
    const rows = await query<{ result: unknown }>(
      statement.text,
      statement.values,
    );
    const result = parseStaffNoticeResult(rows[0]?.result);

    if (result !== "ok") {
      console.warn(`[staff] notice ${result}`);
      return fail(result, statusFor(result));
    }

    console.log("[staff] notice sent");
    return Response.json(
      { ok: true, username: recipient.value },
      { status: 200, headers: NO_STORE },
    );
  } catch (error) {
    console.error("[staff] notice failed", error);
    return fail("unavailable", 503);
  }
}
