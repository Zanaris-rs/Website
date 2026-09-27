import type { NextRequest } from "next/server";

import { checkStageInput, stageSaveStatement } from "@/lib/adventurer-log/persona-input";
import { fail, readJson, runWrite, writer } from "@/lib/adventurer-log/route";

/**
 * `POST /api/adventurer-log/persona/stage` `{ scene, facing }` - Character ›
 * Look's instant saves: the scene the figure stands in, and "Face this way"
 * (migration 17's `adventure_persona_save_stage`). Picks only, so a mute
 * does not stop it.
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const who = await writer(request, "persona stage");
  if ("response" in who) return who.response;

  const input = checkStageInput(await readJson(request));
  if (!input.ok) return fail(input.error, 400);

  return runWrite(stageSaveStatement(who.username, input.value), "adventure_persona_save_stage");
}
