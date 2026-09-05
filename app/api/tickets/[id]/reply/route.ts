import type { NextRequest } from "next/server";

import { assertSameOrigin } from "@/lib/account/origin";
import { requireLiveSession } from "@/lib/account/session-server";
import { validateBody } from "@/lib/messages/format";
import {
  parseId,
  parseTicketReplyResult,
  statusFor,
  ticketReplyStatement,
} from "@/lib/messages/queries";
import { isConfigured, query } from "@/lib/db";

/**
 * `POST /api/tickets/<id>/reply` — add a message to a ticket you own.
 *
 * The four answers `accounts.ticket_reply` can give all mean something
 * different to the person typing, so none of them is collapsed:
 *
 * - `not_found` (404) — no such ticket, or not yours. The two are the same
 *   answer by design.
 * - `closed` (409) — staff closed it. A conflict with the ticket's state, not
 *   a malformed request, and the page turns it into "This ticket is closed"
 *   with a link to open a new one.
 * - `rate_limited` (429) — twenty of the player's own messages in an hour. A
 *   staff reply never spends this allowance; the count is on
 *   `from_staff = false` rows only.
 * - `invalid` (400) — an empty or over-long body, which the check here has
 *   almost always caught first with a sentence that names the field.
 *
 * Before any of them, `requireLiveSession` re-reads the account: a cookie
 * minted before a password change cannot write into a ticket.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

type Body = { body?: unknown };

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/tickets/[id]/reply">,
) {
  let payload: Body;
  try {
    payload = (await request.json()) as Body;
  } catch {
    return fail("bad_request", 400);
  }

  const live = await requireLiveSession();
  if (live.status !== "ok") {
    return fail(live.refusal.error, live.refusal.status);
  }

  if (!assertSameOrigin(request.headers)) {
    console.warn("[tickets] refused: cross-origin reply");
    return fail("origin", 403);
  }

  const { id: raw } = await context.params;
  const id = parseId(raw);
  if (id === null) return fail("bad_request", 400);

  const text = validateBody(
    typeof payload.body === "string" ? payload.body : "",
  );
  if (!text.ok) return fail(text.error, 400);

  if (!isConfigured()) return fail("unavailable", 503);

  try {
    const statement = ticketReplyStatement(
      live.profile.username,
      id,
      text.value,
    );
    const rows = await query<{ result: unknown }>(
      statement.text,
      statement.values,
    );
    const result = parseTicketReplyResult(rows[0]?.result);

    if (result !== "ok") {
      console.warn(`[tickets] reply ${result}`);
      return fail(result, statusFor(result));
    }

    console.log("[tickets] replied");
    return Response.json({ ok: true }, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("[tickets] reply failed", error);
    return fail("unavailable", 503);
  }
}
