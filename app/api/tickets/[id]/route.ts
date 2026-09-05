import { readSession } from "@/lib/account/session-server";
import {
  parseId,
  parseThread,
  ticketThreadStatement,
} from "@/lib/messages/queries";
import { isConfigured, query } from "@/lib/db";

/**
 * `GET /api/tickets/<id>` — one ticket and every message on it, oldest first.
 *
 * **This GET writes too**, for the same reason `/api/messages/[id]` does:
 * `accounts.ticket_thread` marks that ticket's `reply` notices read as the
 * thread is opened, so the unread count the game shows goes down when the
 * player actually reads the reply and not before.
 *
 * A ticket that is not this account's returns no rows, exactly as one that
 * does not exist does — so this answers 404 without ever telling a caller
 * which of the two it was.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/tickets/[id]">,
) {
  const session = await readSession();
  if (!session) return fail("session_expired", 401);

  const { id: raw } = await context.params;
  const id = parseId(raw);
  if (id === null) return fail("bad_request", 400);

  if (!isConfigured()) return fail("unavailable", 503);

  try {
    const statement = ticketThreadStatement(session.u, id);
    const rows = await query<Record<string, unknown>>(
      statement.text,
      statement.values,
    );
    const ticket = parseThread(rows);
    if (!ticket) return fail("not_found", 404);

    return Response.json({ ticket }, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("[tickets] thread failed", error);
    return fail("unavailable", 503);
  }
}
