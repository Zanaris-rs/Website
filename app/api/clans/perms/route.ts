import type { NextRequest } from "next/server";

import { fail, readJson, runWrite, writer } from "@/lib/adventurer-log/route";
import { checkPermsInput } from "@/lib/clans/input";
import { CLAN_ANSWERS, clanSetPermsStatement } from "@/lib/clans/queries";

/** `POST /api/clans/perms` `{ invite, remove, ranks, page }` - the Leader's "Who can…", each 0-6. */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const perms = checkPermsInput(await readJson(request));
  if (!perms.ok) return fail(perms.error, 400);

  const who = await writer(request, "clan perms");
  if ("response" in who) return who.response;

  const { invite, remove, ranks, page } = perms.value;
  return runWrite(clanSetPermsStatement(who.username, invite, remove, ranks, page), "clan_set_perms", CLAN_ANSWERS);
}
