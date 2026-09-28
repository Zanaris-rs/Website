import type { NextRequest } from "next/server";

import { fail, runWrite, writer } from "@/lib/adventurer-log/route";
import { CLAN_ANSWERS, clanNoticeDeleteStatement } from "@/lib/clans/queries";
import { parseId } from "@/lib/messages/queries";

/**
 * `DELETE /api/clans/notices/<id>` - delete a notice: your own, or any if
 * your rank may post them. It still counts towards the clan's 10 a day.
 */

export const runtime = "nodejs";

export async function DELETE(request: NextRequest, context: RouteContext<"/api/clans/notices/[id]">) {
  const id = parseId((await context.params).id);
  if (id === null) return fail("no_notice", 404);

  const who = await writer(request, "clan notice delete");
  if ("response" in who) return who.response;

  return runWrite(clanNoticeDeleteStatement(who.username, id), "clan_notice_delete", CLAN_ANSWERS);
}
