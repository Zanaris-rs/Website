import type { NextRequest } from "next/server";

import { assertSameOrigin } from "@/lib/account/origin";
import { requireLiveSession } from "@/lib/account/session-server";
import { isConfigured, query } from "@/lib/db";
import {
  outfitSetDefaultStatement,
  outfitStatusFor,
  parseOutfitWrite,
} from "@/lib/outfits/queries";
import { answer, fail, parseSlot, readOutfits } from "@/lib/outfits/route";

/**
 * `POST /api/outfits/<slot>/default` — make this outfit the player's picture.
 * `empty` (409) when nothing is saved in the slot. Answers with the outfits.
 */

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/outfits/[slot]/default">,
) {
  const live = await requireLiveSession();
  if (live.status !== "ok") {
    return fail(live.refusal.error, live.refusal.status);
  }
  if (!assertSameOrigin(request.headers)) {
    console.warn("[outfits] refused: cross-origin default");
    return fail("origin", 403);
  }

  const slot = parseSlot((await context.params).slot);
  if (slot === null) return fail("bad_slot", 400);

  if (!isConfigured()) return fail("unavailable", 503);

  const { username } = live.profile;
  try {
    const statement = outfitSetDefaultStatement(username, slot);
    const rows = await query<{ result: unknown }>(statement.text, statement.values);
    const result = parseOutfitWrite(rows[0]?.result, "outfit_set_default");
    if (result !== "ok") {
      console.warn(`[outfits] default ${result}`);
      return fail(result, outfitStatusFor(result));
    }
    return answer(await readOutfits(username));
  } catch (error) {
    console.error("[outfits] default failed", error);
    return fail("unavailable", 503);
  }
}
