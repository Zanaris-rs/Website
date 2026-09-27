import type { NextRequest } from "next/server";

import { fail, readJson, runWrite, writer } from "@/lib/adventurer-log/route";
import { CLAN_ANSWERS, clanInviteAnswerStatement } from "@/lib/clans/queries";

/**
 * `POST /api/clans/invites/answer` `{ clanId, accept }` - join the clan that
 * invited you, or decline. Accepting deletes that invitation only; the
 * others stay. You cannot accept while in a clan.
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = await readJson(request);
  const accept = payload?.accept;
  if (typeof accept !== "boolean") return fail("bad_request", 400);
  const clanId = payload?.clanId;
  if (typeof clanId !== "number" || !Number.isInteger(clanId) || clanId < 1) return fail("no_invite", 404);

  const who = await writer(request, "clan invite answer");
  if ("response" in who) return who.response;

  return runWrite(clanInviteAnswerStatement(who.username, clanId, accept), "clan_invite_answer", CLAN_ANSWERS);
}
