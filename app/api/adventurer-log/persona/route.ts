import type { NextRequest } from "next/server";

import { checkPersonaInput, personaSaveStatement } from "@/lib/adventurer-log/persona-input";
import { fail, readJson, runWrite, writer } from "@/lib/adventurer-log/route";

/**
 * `POST /api/adventurer-log/persona` - the Character tab's one Save: the
 * headline, its colour and effect, the sheet, the scene, the signature emote
 * and the dialogue (migration 16). A mute refuses new words but not new
 * picks; the database decides which this is.
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Who is asking, and from where, before anything about what they sent.
  const who = await writer(request, "persona");
  if ("response" in who) return who.response;

  const input = checkPersonaInput(await readJson(request));
  if (!input.ok) return fail(input.error, 400);

  return runWrite(personaSaveStatement(who.username, input.value), "adventure_persona_save");
}
