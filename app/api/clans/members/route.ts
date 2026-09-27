import type { NextRequest } from "next/server";

import { fail, readJson, runWrite, writer } from "@/lib/adventurer-log/route";
import { INVALID_NAME, toSafeName } from "@/lib/base37";
import { CLAN_ANSWERS, clanRemoveStatement } from "@/lib/clans/queries";

/** `DELETE /api/clans/members` `{ target }` - remove a member you outrank, if your rank may (`perm_remove`). */

export const runtime = "nodejs";

export async function DELETE(request: NextRequest) {
  const payload = await readJson(request);
  if (!payload || typeof payload.target !== "string") return fail("bad_request", 400);
  const target = toSafeName(payload.target);
  if (target === INVALID_NAME) return fail("no_such_member", 404);

  const who = await writer(request, "clan remove");
  if ("response" in who) return who.response;

  return runWrite(clanRemoveStatement(who.username, target), "clan_remove", CLAN_ANSWERS);
}
