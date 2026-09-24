import type { NextRequest } from "next/server";

import { assertSameOrigin } from "@/lib/account/origin";
import { requireLiveSession } from "@/lib/account/session-server";
import { checkOutfit } from "@/lib/chathead/validate";
import { isConfigured, query } from "@/lib/db";
import {
  outfitDeleteStatement,
  outfitSaveStatement,
  outfitStatusFor,
  parseOutfitWrite,
} from "@/lib/outfits/queries";
import { answer, fail, parseSlot, readOutfits } from "@/lib/outfits/route";

/**
 * `POST /api/outfits/<slot>` saves an outfit into a slot, replacing what was
 * there; `DELETE` empties it. Both answer with the player's outfits as they
 * now are.
 *
 * The outfit is checked here first (`checkOutfit`: a kit the design screen
 * offers, an object in the slot it is worn in, colours in their palettes)
 * with a sentence naming what is wrong; `accounts.outfit_save` checks the
 * shape again, because it is the database's to keep. The username is the
 * verified session's - `requireLiveSession` re-reads the account, so a cookie
 * from before a password change cannot write.
 */

export const runtime = "nodejs";

async function authorise(request: NextRequest) {
  const live = await requireLiveSession();
  if (live.status !== "ok") {
    return { response: fail(live.refusal.error, live.refusal.status) };
  }
  if (!assertSameOrigin(request.headers)) {
    console.warn("[outfits] refused: cross-origin write");
    return { response: fail("origin", 403) };
  }
  return { username: live.profile.username };
}

export async function POST(
  request: NextRequest,
  context: RouteContext<"/api/outfits/[slot]">,
) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("bad_request", 400);
  }

  const who = await authorise(request);
  if (!who.username) return who.response;

  const slot = parseSlot((await context.params).slot);
  if (slot === null) return fail("bad_slot", 400);

  const checked = checkOutfit(payload);
  if (!checked.ok) return fail(checked.error, 400);

  if (!isConfigured()) return fail("unavailable", 503);

  try {
    const statement = outfitSaveStatement(who.username, slot, checked.outfit);
    const rows = await query<{ result: unknown }>(statement.text, statement.values);
    const result = parseOutfitWrite(rows[0]?.result, "outfit_save");
    if (result !== "ok") {
      console.warn(`[outfits] save ${result}`);
      return fail(result, outfitStatusFor(result));
    }
    return answer(await readOutfits(who.username));
  } catch (error) {
    console.error("[outfits] save failed", error);
    return fail("unavailable", 503);
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext<"/api/outfits/[slot]">,
) {
  const who = await authorise(request);
  if (!who.username) return who.response;

  const slot = parseSlot((await context.params).slot);
  if (slot === null) return fail("bad_slot", 400);

  if (!isConfigured()) return fail("unavailable", 503);

  try {
    const statement = outfitDeleteStatement(who.username, slot);
    const rows = await query<{ result: unknown }>(statement.text, statement.values);
    const result = parseOutfitWrite(rows[0]?.result, "outfit_delete");
    if (result !== "ok") {
      console.warn(`[outfits] delete ${result}`);
      return fail(result, outfitStatusFor(result));
    }
    return answer(await readOutfits(who.username));
  } catch (error) {
    console.error("[outfits] delete failed", error);
    return fail("unavailable", 503);
  }
}
