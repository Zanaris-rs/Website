import type { NextRequest } from "next/server";

import { parseBody } from "@/lib/adventurer-log/body";
import { checkText, REPLY_MAX } from "@/lib/adventurer-log/format";
import { logStatusFor, parsePost, replyPostStatement } from "@/lib/adventurer-log/queries";
import { fail, NO_STORE, readJson, writer } from "@/lib/adventurer-log/route";
import type { ReplyView } from "@/lib/adventurer-log/view";
import { query } from "@/lib/db";
import { displayName } from "@/lib/hiscores/format";
import { parseId } from "@/lib/messages/queries";
import { defaultLooksStatement, parseDefaultLooks } from "@/lib/outfits/queries";

/**
 * `POST /api/adventurer-log/updates/<id>/replies` `{ body }` — reply under an
 * update. Refused (`blocked`, 403) when the log's owner has blocked you.
 * Answers `{ reply, look }`: the reply as the timeline draws it, and your
 * default look for its chathead.
 */

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/adventurer-log/updates/[id]/replies">,
) {
  const payload = await readJson(request);
  if (!payload) return fail("bad_request", 400);

  const who = await writer(request, "reply");
  if ("response" in who) return who.response;

  const updateId = parseId((await context.params).id);
  if (updateId === null) return fail("not_found", 404);

  const text = checkText(payload.body, "Your reply", REPLY_MAX);
  if (!text.ok) return fail(text.error, 400);

  try {
    const statement = replyPostStatement(who.username, updateId, text.value);
    const posted = parsePost(
      await query<Record<string, unknown>>(statement.text, statement.values),
      "reply_id",
      "adventure_reply_post",
    );
    if (posted.result !== "ok" || posted.id === null) {
      console.warn(`[adventurer-log] reply ${posted.result}`);
      return fail(posted.result, logStatusFor(posted.result));
    }

    const looks = defaultLooksStatement([who.username]);
    const look =
      parseDefaultLooks(await query<Record<string, unknown>>(looks.text, looks.values)).get(who.username) ?? null;

    const reply: ReplyView = {
      id: posted.id,
      author: who.username,
      authorName: displayName(who.username),
      at: new Date().toISOString(),
      tokens: parseBody(text.value),
      canDelete: true,
    };
    return Response.json({ reply, look }, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("[adventurer-log] reply failed", error);
    return fail("unavailable", 503);
  }
}
