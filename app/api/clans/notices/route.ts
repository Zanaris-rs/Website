import type { NextRequest } from "next/server";

import { fail, readJson, runWrite, writer } from "@/lib/adventurer-log/route";
import { checkNoticeInput } from "@/lib/clans/input";
import { CLAN_ANSWERS, clanNoticePostStatement } from "@/lib/clans/queries";

/**
 * `POST /api/clans/notices` `{ title, body }` - post a notice, if your rank
 * may (`perm_page`). The newest 20 are kept, and a clan posts at most 10 a
 * day; a deleted notice still counts towards the 10. A mute refuses it: a
 * notice is words.
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const notice = checkNoticeInput(await readJson(request));
  if (!notice.ok) return fail(notice.error, 400);

  const who = await writer(request, "clan notice");
  if ("response" in who) return who.response;

  return runWrite(
    clanNoticePostStatement(who.username, notice.value.title, notice.value.body),
    "clan_notice_post",
    CLAN_ANSWERS,
  );
}
