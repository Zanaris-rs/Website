import type { NextRequest } from "next/server";

import { checkSheetInput, sheetSaveStatement } from "@/lib/adventurer-log/persona-input";
import { fail, readJson, runWrite, writer } from "@/lib/adventurer-log/route";

/**
 * `POST /api/adventurer-log/persona/sheet` - Character › Sheet's one Save:
 * title, examine, hangout, goals, god, home town and About (migration 18's
 * eight-argument `adventure_persona_save_sheet`, which writes About to the
 * log in the same transaction). A mute is refused a changed title, examine,
 * hangout, goal or About; the god and home town are picks.
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const who = await writer(request, "persona sheet");
  if ("response" in who) return who.response;

  const input = checkSheetInput(await readJson(request));
  if (!input.ok) return fail(input.error, 400);

  return runWrite(sheetSaveStatement(who.username, input.value), "adventure_persona_save_sheet");
}
