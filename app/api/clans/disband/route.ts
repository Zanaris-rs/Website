import type { NextRequest } from "next/server";

import { runWrite, writer } from "@/lib/adventurer-log/route";
import { CLAN_ANSWERS, clanDisbandStatement } from "@/lib/clans/queries";

/**
 * `POST /api/clans/disband` - the Leader ends the clan: its members, its
 * invitations and its notices go with it. The tab confirms first; the
 * same-origin check in `writer()` stops a call from another site.
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const who = await writer(request, "clan disband");
  if ("response" in who) return who.response;
  return runWrite(clanDisbandStatement(who.username), "clan_disband", CLAN_ANSWERS);
}
