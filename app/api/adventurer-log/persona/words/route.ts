import type { NextRequest } from "next/server";

import { checkWordsInput, wordsSaveStatement } from "@/lib/adventurer-log/persona-input";
import { fail, readJson, runWrite, writer } from "@/lib/adventurer-log/route";

/**
 * `POST /api/adventurer-log/persona/words` `{ signatureEmote, dialogue }` -
 * Character › Words' one Save: the signature emote and the dialogue, each
 * page with its overhead colour and effect (migration 18's three-argument
 * `adventure_persona_save_words`). A mute is refused a changed line but may
 * change the picks, colours and effects included; the database decides
 * which this is.
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
