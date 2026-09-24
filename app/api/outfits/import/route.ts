import { requireLiveSession } from "@/lib/account/session-server";
import { isConfigured, query } from "@/lib/db";
import {
  outfitImportStatement,
  outfitStatusFor,
  parseOutfitImport,
} from "@/lib/outfits/queries";
import { fail, NO_STORE } from "@/lib/outfits/route";

/**
 * `GET /api/outfits/import` — the look of the player's last save in the game
 * (`account_look`, written by the login server at every logout and
 * autosave). It writes nothing: the editor puts the look in the open slot
 * and the player saves it. `no_look` (404) until the game has saved them
 * once since migration 11.
 */

export const runtime = "nodejs";

export async function GET() {
  const live = await requireLiveSession();
  if (live.status !== "ok") {
    return fail(live.refusal.error, live.refusal.status);
  }

  if (!isConfigured()) return fail("unavailable", 503);

  try {
    const statement = outfitImportStatement(live.profile.username);
    const imported = parseOutfitImport(
      await query<Record<string, unknown>>(statement.text, statement.values),
    );
    if (imported.result !== "ok") {
      return fail(imported.result, outfitStatusFor(imported.result));
    }
    return Response.json(
      { look: imported.look, savedAt: imported.savedAt },
      { status: 200, headers: NO_STORE },
    );
  } catch (error) {
    console.error("[outfits] import failed", error);
    return fail("unavailable", 503);
  }
}
