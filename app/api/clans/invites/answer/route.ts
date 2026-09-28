import type { NextRequest } from "next/server";

import { fail, readJson, runWrite, writer } from "@/lib/adventurer-log/route";
import { checkAnswerInput } from "@/lib/clans/input";
import { CLAN_ANSWERS, clanInviteAnswerStatement } from "@/lib/clans/queries";

/**
 * `POST /api/clans/invites/answer` `{ clanId, accept }` - join the clan that
 * invited you, or decline. Accepting deletes that invitation only; the
 * others stay. You cannot accept while in a clan. A `clanId` that is not a
 * row id (past int4 included) is an invitation that is not there: 404.
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const answer = checkAnswerInput(await readJson(request));
  if (!answer.ok) return fail(answer.error, answer.error === "no_invite" ? 404 : 400);

  const who = await writer(request, "clan invite answer");
  if ("response" in who) return who.response;

  const { clanId, accept } = answer.value;
  return runWrite(clanInviteAnswerStatement(who.username, clanId, accept), "clan_invite_answer", CLAN_ANSWERS);
}
