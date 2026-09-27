import type { NextRequest } from "next/server";

import { fail, readJson, runWrite, writer } from "@/lib/adventurer-log/route";
import { INVALID_NAME, toSafeName } from "@/lib/base37";
import { CLAN_ANSWERS, clanSetRankStatement } from "@/lib/clans/queries";
import { isRank } from "@/lib/clans/ranks";

/**
 * `POST /api/clans/members/rank` `{ target, rank }` - give a member you
 * outrank a rank below your own, if your rank may (`perm_ranks`). Your own
 * rank is not below you, so changing it is `forbidden`.
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = await readJson(request);
  if (!payload || typeof payload.target !== "string") return fail("bad_request", 400);
  const rank = payload.rank;
  if (!isRank(rank)) return fail("bad_rank", 400);
  const target = toSafeName(payload.target);
  if (target === INVALID_NAME) return fail("no_such_member", 404);

  const who = await writer(request, "clan set rank");
  if ("response" in who) return who.response;

  return runWrite(clanSetRankStatement(who.username, target, rank), "clan_set_rank", CLAN_ANSWERS);
}
