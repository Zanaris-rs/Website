import type { NextRequest } from "next/server";

import { parseBody } from "@/lib/adventurer-log/body";
import { checkText, UPDATE_MAX } from "@/lib/adventurer-log/format";
import { logStatusFor, parsePost, updatePostStatement } from "@/lib/adventurer-log/queries";
import { fail, NO_STORE, readJson, writer } from "@/lib/adventurer-log/route";
import type { EntryView } from "@/lib/adventurer-log/view";
import { query } from "@/lib/db";

/**
 * `POST /api/adventurer-log/updates` `{ body }` — post an update on your own
 * log. Answers `{ entry }`, the new update as the timeline draws it, so the
 * page can put it at the top without reading the timeline again.
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = await readJson(request);
  if (!payload) return fail("bad_request", 400);

  const who = await writer(request, "update");
  if ("response" in who) return who.response;

  const text = checkText(payload.body, "Your update", UPDATE_MAX);
  if (!text.ok) return fail(text.error, 400);

  try {
    const statement = updatePostStatement(who.username, text.value);
    const posted = parsePost(
      await query<Record<string, unknown>>(statement.text, statement.values),
      "update_id",
      "adventure_update_post",
    );
    if (posted.result !== "ok" || posted.id === null) {
      console.warn(`[adventurer-log] update ${posted.result}`);
      return fail(posted.result, logStatusFor(posted.result));
    }

    const entry: EntryView = {
      kind: "update",
      key: `u${posted.id}`,
      id: posted.id,
      at: new Date().toISOString(),
      body: text.value,
      tokens: parseBody(text.value),
      editedAt: null,
      replyCount: 0,
      replies: [],
    };
    return Response.json({ entry }, { status: 200, headers: NO_STORE });
  } catch (error) {
    console.error("[adventurer-log] update failed", error);
    return fail("unavailable", 503);
  }
}
