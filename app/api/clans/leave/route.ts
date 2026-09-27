import type { NextRequest } from "next/server";

import { runWrite, writer } from "@/lib/adventurer-log/route";
import { CLAN_ANSWERS, clanLeaveStatement } from "@/lib/clans/queries";

/**
 * `POST /api/clans/leave` - leave your clan. The Leader cannot while others
 * remain (`leader`); a Leader who is the last member leaves and the clan is
 * disbanded.
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const who = await writer(request, "clan leave");
  if ("response" in who) return who.response;
  return runWrite(clanLeaveStatement(who.username), "clan_leave", CLAN_ANSWERS);
}
