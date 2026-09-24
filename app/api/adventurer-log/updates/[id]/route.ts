import type { NextRequest } from "next/server";

import { updateDeleteStatement } from "@/lib/adventurer-log/queries";
import { fail, runWrite, writer } from "@/lib/adventurer-log/route";
import { parseId } from "@/lib/messages/queries";

/** `DELETE /api/adventurer-log/updates/<id>` — take down one of your own updates. */

export const runtime = "nodejs";

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
