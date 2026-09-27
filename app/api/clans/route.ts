import type { NextRequest } from "next/server";

import { fail, readJson, runWrite, writer } from "@/lib/adventurer-log/route";
import { checkClanFields } from "@/lib/clans/input";
import { CLAN_ANSWERS, clanCreateStatement } from "@/lib/clans/queries";

/**
 * `POST /api/clans` `{ name, motto, crest, world }` - start a clan and lead
 * it (migration 17's `clan_create`). One clan at a time; a muted player
 * cannot start one, because its name is words. A name like "Clan 123" is
 * kept for staff and refused here.
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const fields = checkClanFields(await readJson(request), "create");
  if (!fields.ok) return fail(fields.error, 400);

  const who = await writer(request, "clan create");
  if ("response" in who) return who.response;

  const { name, motto, crest, world } = fields.value;
  return runWrite(clanCreateStatement(who.username, name, motto, crest, world), "clan_create", CLAN_ANSWERS);
}
