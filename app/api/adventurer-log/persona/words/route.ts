import type { NextRequest } from "next/server";

import { checkWordsInput, wordsSaveStatement } from "@/lib/adventurer-log/persona-input";
import { fail, readJson, runWrite, writer } from "@/lib/adventurer-log/route";

/**
 * `POST /api/adventurer-log/persona/words` - Character › Words' one Save:
 * the headline, its colour and effect, the signature emote and the dialogue
 * (migration 17's `adventure_persona_save_words`). A mute is refused new
 * words (the headline or any line) but may change the picks; the database
 * decides which this is.
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Who is asking, and from where, before anything about what they sent.
  const who = await writer(request, "persona words");
  if ("response" in who) return who.response;

  const input = checkWordsInput(await readJson(request));
  if (!input.ok) return fail(input.error, 400);

  return runWrite(wordsSaveStatement(who.username, input.value), "adventure_persona_save_words");
}
