import {
  type MessageSummary,
  messagesStatement,
  parseMessageSummary,
} from "@/lib/messages/queries";
import { readSession } from "@/lib/account/session-server";
import { isConfigured, query } from "@/lib/db";

/**
 * `GET /api/messages` — every message in the signed-in account's inbox,
 * unread first, with a 160-character preview instead of a body.
 *
 * One call. `accounts.messages` is keyed by the username out of the signed
 * cookie and joins to `account` itself, so there is no id here for anybody to
 * tamper with and no way for this route to name a different inbox.
 *
 * `unread` is counted off the rows rather than by calling `accounts.unread` as
 * well: the two would be one round trip apart and could disagree, and a list
 * that says "2 unread" above two rows that are both marked read is a bug
 * report. The rule is the same either way — a message with no `read_at`.
 *
 * `no-store`, like everything else that reads a cookie: a cached copy is one
 * player's inbox served to the next.
 */

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number): Response {
  return Response.json({ error }, { status, headers: NO_STORE });
}

export async function GET() {
  const session = await readSession();
  if (!session) return fail("session_expired", 401);

  if (!isConfigured()) return fail("unavailable", 503);

  try {
    const statement = messagesStatement(session.u);
    const rows = await query<Record<string, unknown>>(
      statement.text,
      statement.values,
    );
    const messages = rows
      .map(parseMessageSummary)
      .filter((message): message is MessageSummary => message !== null);

    return Response.json(
      {
        unread: messages.filter((message) => message.readAt === null).length,
        messages,
      },
      { status: 200, headers: NO_STORE },
    );
  } catch (error) {
    console.error("[messages] list failed", error);
    return fail("unavailable", 503);
  }
}
