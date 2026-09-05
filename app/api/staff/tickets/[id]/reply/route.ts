import type { NextRequest } from "next/server";

import { assertSameOrigin } from "@/lib/account/origin";
import { readSession } from "@/lib/account/session-server";
import { validateBody } from "@/lib/messages/format";
import { parseId, statusFor } from "@/lib/messages/queries";
import { parseStaffReplyResult, staffReplyStatement } from "@/lib/staff/queries";
import { loadStaff } from "@/lib/staff/staff-server";
import { isConfigured, query } from "@/lib/db";

/**
 * `POST /api/staff/tickets/<id>/reply` — `{ body, close? }`.
 *
 * One call, two rows, always: the message staff see on the thread, and the
 * `account_message` of kind `reply` that makes the player's unread count go up
 * — immediately on the site, and on their next login in game. Plus a
 * `staff_action` row, so who replied to what is on the record.
 *
 * `close` is not a separate verb because closing without a word is the rude
 * version of this: the same call writes the reply and sets the status. It is
 * also the only way to write on an already-closed ticket, which is exactly the
 * case where staff still need to — a closed ticket refuses a plain reply, the
 * same way it refuses the player's.
 *
 * `forbidden` from the function is mapped rather than assumed unreachable.
 * `loadStaff` should have caught it a few lines earlier; if the two ever
 * disagree, the honest answer is 403 and not a 500.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

type Body = { body?: unknown; close?: unknown };

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/staff/tickets/[id]/reply">,
) {
  let payload: Body;
  try {
    payload = (await request.json()) as Body;
  } catch {
    return fail("bad_request", 400);
  }

  const session = await readSession();
  if (!session) return fail("session_expired", 401);

  if (!assertSameOrigin(request.headers)) {
    console.warn("[staff] refused: cross-origin reply");
    return fail("origin", 403);
  }

  const staff = await loadStaff(session);
  if (staff.status === "unavailable") return fail("unavailable", 503);
  if (staff.status === "signed_out") return fail("session_expired", 401);
  if (staff.status === "forbidden") return fail("forbidden", 403);

  const { id: raw } = await context.params;
  const id = parseId(raw);
  if (id === null) return fail("bad_request", 400);

  const text = validateBody(
    typeof payload.body === "string" ? payload.body : "",
  );
  if (!text.ok) return fail(text.error, 400);

  const close = payload.close === true;

  if (!isConfigured()) return fail("unavailable", 503);

  try {
    const statement = staffReplyStatement(
      staff.profile.username,
      id,
      text.value,
      close,
    );
    const rows = await query<{ result: unknown }>(
      statement.text,
      statement.values,
    );
    const result = parseStaffReplyResult(rows[0]?.result);

    if (result !== "ok") {
      console.warn(`[staff] reply ${result}`);
      return fail(result, statusFor(result));
    }

    console.log(`[staff] replied${close ? " and closed" : ""}`);
    return Response.json(
      { ok: true, closed: close },
      { status: 200, headers: NO_STORE },
    );
  } catch (error) {
    console.error("[staff] reply failed", error);
    return fail("unavailable", 503);
  }
}
