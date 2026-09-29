import type { NextRequest } from "next/server";

import { checkShowsInput } from "@/lib/adventurer-log/parts";
import { showsSaveStatement } from "@/lib/adventurer-log/queries";
import { fail, readJson, runWrite, writer } from "@/lib/adventurer-log/route";

/**
 * `POST /api/adventurer-log/shows` `{ hiddenCategories: number[], hiddenParts: PartKey[] }`
 * - Log settings' "What your log shows" in one Save: the kinds of adventure
 * the log hides and the parts of it (`parts.ts`), both at once (migration
 * 18's `adventure_log_save_shows`). Hidden for everyone, the owner included.
 * Picks only, so a mute does not stop it. About, which this box once saved,
 * is on Character › Sheet now (`/api/adventurer-log/persona/sheet`).
 */

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Who is asking, and from where, before anything about what they sent.
  const who = await writer(request, "shows");
  if ("response" in who) return who.response;

  const input = checkShowsInput(await readJson(request));
  if (!input.ok) return fail(input.error, 400);

  return runWrite(
    showsSaveStatement(who.username, input.value.categories, input.value.parts),
    "adventure_log_save_shows",
  );
}
