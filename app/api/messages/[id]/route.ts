import {
  messageStatement,
  parseId,
  parseMessageDetail,
} from "@/lib/messages/queries";
import { requireLiveSession } from "@/lib/account/session-server";
import { isConfigured, query } from "@/lib/db";

/**
 * `GET /api/messages/<id>` — one message, with its body.
 *
 * **This GET writes.** `accounts.message` returns the row and then marks it
 * read, because opening a message *is* reading it and there is nothing else on
 * the page for the reader to press. `read_at` comes back as it was before the
 * call, so the page can still say "new" the one time that is true. It is why
 * this route is `no-store` and why it must never become cacheable: a cached
 * copy would be a message that never gets marked read, and a player whose
 * in-game unread count never goes down.
 *
 * The cookie is checked against the database first (`requireLiveSession`):
 * this GET writes, and a revoked cookie must not be able to mark anything
 * read.
 *
 * A message belonging to somebody else and a message that does not exist are
 * the same 404. The function resolves the username to an account id and
 * requires `m.account_id` to match, so it returns no rows in both cases —
 * deliberately indistinguishable, so that ids cannot be probed for existence.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/messages/[id]">,
) {
  const live = await requireLiveSession();
  if (live.status !== "ok") {
    return fail(live.refusal.error, live.refusal.status);
  }

  const { id: raw } = await context.params;
  const id = parseId(raw);
  if (id === null) return fail("bad_request", 400);

  if (!isConfigured()) return fail("unavailable", 503);

  try {
    const statement = messageStatement(live.profile.username, id);
    const rows = await query<Record<string, unknown>>(
      statement.text,
      statement.values,
    );
    const message = parseMessageDetail(rows[0]);
    if (!message) return fail("not_found", 404);

    return Response.json({ message }, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("[messages] read failed", error);
    return fail("unavailable", 503);
  }
}
