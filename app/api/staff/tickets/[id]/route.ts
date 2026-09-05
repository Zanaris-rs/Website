import { readSession } from "@/lib/account/session-server";
import { parseId } from "@/lib/messages/queries";
import { parseStaffThread, staffThreadStatement } from "@/lib/staff/queries";
import { loadStaff } from "@/lib/staff/staff-server";
import { isConfigured, query } from "@/lib/db";

/**
 * `GET /api/staff/tickets/<id>` — a ticket as staff see it: the same thread,
 * plus the owner's username.
 *
 * Unlike the player's `ticket_thread`, this one **marks nothing read**. The
 * unread flags belong to the player: a moderator opening a ticket must not
 * quietly clear the notice that tells the player there is a reply waiting.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/staff/tickets/[id]">,
) {
  const session = await readSession();
  if (!session) return fail("session_expired", 401);

  const staff = await loadStaff(session);
  if (staff.status === "unavailable") return fail("unavailable", 503);
  if (staff.status === "signed_out") return fail("session_expired", 401);
  if (staff.status === "forbidden") return fail("forbidden", 403);

  const { id: raw } = await context.params;
  const id = parseId(raw);
  if (id === null) return fail("bad_request", 400);

  if (!isConfigured()) return fail("unavailable", 503);

  try {
    const statement = staffThreadStatement(staff.profile.username, id);
    const rows = await query<Record<string, unknown>>(
      statement.text,
      statement.values,
    );
    const ticket = parseStaffThread(rows);
    if (!ticket) return fail("not_found", 404);

    return Response.json({ ticket }, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("[staff] thread failed", error);
    return fail("unavailable", 503);
  }
}
