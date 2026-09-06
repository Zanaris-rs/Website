import type { NextRequest } from "next/server";

import { assertSameOrigin } from "@/lib/account/origin";
import { readSession } from "@/lib/account/session-server";
import {
  PASSWORD_MAX_TYPED,
  canonicalizeUsername,
} from "@/lib/account/validation";
import { validateBody, validateSubject } from "@/lib/messages/format";
import { statusFor } from "@/lib/messages/queries";
import { candidateHash } from "@/lib/staff/actor-server";
import { parseStaffNoticeResult, staffNoticeStatement } from "@/lib/staff/queries";
import { loadStaff } from "@/lib/staff/staff-server";
import { isConfigured, query } from "@/lib/db";

/**
 * `POST /api/staff/notice` — write a notice into a player's Message Centre in
 * a staff member's name. `{ username, subject, body, password }`.
 *
 * This writes into somebody else's inbox under a moderator's name, so it
 * **re-types a password**: `lib/staff/actor-server.ts` runs the salt handshake
 * and `accounts.staff_notice` compares the candidate against the stored hash.
 * The compare is the authorisation — a leaked `website` credential still
 * cannot impersonate a moderator, because it does not know the moderator's
 * password. Resolving a report and lifting a ban go through the same helper.
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
    const candidate = await candidateHash(actor, password);
    if (!candidate.ok) return fail(candidate.error, candidate.status);

    const statement = staffNoticeStatement(
      actor,
      candidate.hash,
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
