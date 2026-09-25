import type { NextRequest } from "next/server";

import { parseBody } from "@/lib/adventurer-log/body";
import { checkText, UPDATE_MAX } from "@/lib/adventurer-log/format";
import { logStatusFor, parseWrite, updateDeleteStatement, updateEditStatement } from "@/lib/adventurer-log/queries";
import { fail, NO_STORE, readJson, runWrite, writer } from "@/lib/adventurer-log/route";
import { query } from "@/lib/db";
import { parseId } from "@/lib/messages/queries";

/**
 * `PATCH /api/adventurer-log/updates/<id>` `{ body }` — change the text of
 * one of your own updates, under the same rules as posting it (a mute stops
 * it). Answers `{ tokens, editedAt }`: the new text as the timeline draws it,
 * and when it changed. The database leaves `edited_at` alone when the text is
 * what it was, so the page does not send an unchanged text.
 *
 * `DELETE /api/adventurer-log/updates/<id>` — take down one of your own updates.
 */

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/adventurer-log/updates/[id]">,
) {
  const payload = await readJson(request);
  if (!payload) return fail("bad_request", 400);

  const who = await writer(request, "update edit");
  if ("response" in who) return who.response;

  const id = parseId((await context.params).id);
  if (id === null) return fail("not_found", 404);

  const text = checkText(payload.body, "Your update", UPDATE_MAX);
  if (!text.ok) return fail(text.error, 400);

  try {
    const statement = updateEditStatement(who.username, id, text.value);
    const rows = await query<{ result: unknown }>(statement.text, statement.values);
    const result = parseWrite(rows[0]?.result, "adventure_update_edit");
    if (result !== "ok") {
      console.warn(`[adventurer-log] update edit ${result}`);
      return fail(result, logStatusFor(result));
    }
    return Response.json(
      { tokens: parseBody(text.value), editedAt: new Date().toISOString() },
      { status: 200, headers: NO_STORE },
    );
  } catch (error) {
    console.error("[adventurer-log] update edit failed", error);
    return fail("unavailable", 503);
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext<"/api/adventurer-log/updates/[id]">,
) {
  const who = await writer(request, "update delete");
  if ("response" in who) return who.response;

  const id = parseId((await context.params).id);
  if (id === null) return fail("not_found", 404);

  return runWrite(updateDeleteStatement(who.username, id), "update delete");
}
