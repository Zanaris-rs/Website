import type { NextRequest } from "next/server";

import { fail, readJson, runWrite, writer } from "@/lib/adventurer-log/route";
import { checkClanFields } from "@/lib/clans/input";
import { CLAN_ANSWERS, clanSavePageStatement } from "@/lib/clans/queries";

/**
 * `POST /api/clans/page` `{ name, motto, crest, world, about }` - the Clan
 * tab's "Clan page" Save, for a member whose rank may edit it (`perm_page`).
 * A mute keeps the picks (crest, world) but not the words; the database
 * decides which changed. A new name is a new address, and the old one 404s.
 *
 * The name's length and characters are checked here, not the "Clan 123"
 * rule: after a staff hide the clan is named "Clan <id>", and it may keep
 * that name and still save its page. Only the database knows whether the
 * name changed, so `clan_save_page` refuses a new reserved name (`bad_name`).
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const fields = checkClanFields(await readJson(request), "page");
  if (!fields.ok) return fail(fields.error, 400);

  const who = await writer(request, "clan page");
  if ("response" in who) return who.response;

  const { name, motto, crest, world, about } = fields.value;
  return runWrite(
    clanSavePageStatement(who.username, name, motto, crest, world, about),
    "clan_save_page",
    CLAN_ANSWERS,
  );
}
