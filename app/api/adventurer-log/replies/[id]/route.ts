import type { NextRequest } from "next/server";

import { replyDeleteStatement } from "@/lib/adventurer-log/queries";
import { fail, runWrite, writer } from "@/lib/adventurer-log/route";
import { parseId } from "@/lib/messages/queries";

/**
 * `DELETE /api/adventurer-log/replies/<id>` — take a reply down: your own, or
 * any reply on your own log.
 */

export const runtime = "nodejs";

export async function DELETE(
  request: NextRequest,
  context: RouteContext<"/api/adventurer-log/replies/[id]">,
) {
  const who = await writer(request, "reply delete");
  if ("response" in who) return who.response;

  const id = parseId((await context.params).id);
  if (id === null) return fail("not_found", 404);

  return runWrite(replyDeleteStatement(who.username, id), "reply delete");
}
