import type { NextRequest } from "next/server";

import { fail, readJson, runWrite, writer } from "@/lib/adventurer-log/route";
import { INVALID_NAME, toSafeName } from "@/lib/base37";
import { CLAN_ANSWERS, clanHandOverStatement } from "@/lib/clans/queries";

/**
 * `POST /api/clans/hand-over` `{ target }` - the Leader hands the key to a
 * member, and becomes a General.
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = await readJson(request);
  if (!payload || typeof payload.target !== "string") return fail("bad_request", 400);
  const target = toSafeName(payload.target);
  if (target === INVALID_NAME) return fail("no_such_member", 404);

  const who = await writer(request, "clan hand over");
  if ("response" in who) return who.response;

  return runWrite(clanHandOverStatement(who.username, target), "clan_hand_over", CLAN_ANSWERS);
}
