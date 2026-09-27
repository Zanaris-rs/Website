import "server-only";

import { loadAccount } from "@/lib/account/profile-server";
import { requireSession } from "@/lib/account/session-server";
import type { Look } from "@/lib/chathead/look";
import type { SavedOutfits } from "@/lib/chathead/outfit-store";
import { query } from "@/lib/db";
import { readOutfits } from "@/lib/outfits/route";

import { logLook } from "./page-data";
import { type Persona, parsePersona, personaStatement } from "./persona";
import { type LogHeader, logStatement, parseLog } from "./queries";

/**
 * What every Character tab reads, one query after another: the log's header
 * (the name, the headline, the worn outfit's look), the persona, the
 * chathead's look, and the ten outfits.
 *
 * Unlike the log page, a failed persona read is not an empty persona here:
 * a tab would start blank, and its Save would write the blank over it. The
 * page shows "unavailable" instead.
 */

export type CharacterData = {
  header: LogHeader & { result: "ok" };
  persona: Persona;
  /** The chathead's look: the worn outfit, else the game's head-only look. */
  headLook: Look | null;
  outfits: SavedOutfits;
};

export type CharacterPage =
  | { status: "signed_out" }
  | { status: "unavailable" }
  | { status: "ok"; data: CharacterData };

/** The signed-in owner's character, or why there is none to show. */
export async function loadCharacterPage(): Promise<CharacterPage> {
  // Outside any try: it redirects a reader with no session, by throwing.
  const session = await requireSession();
  const loaded = await loadAccount(session);
  if (loaded.status !== "ok") return { status: loaded.status };

  const { username } = loaded.profile;
  try {
    const statement = logStatement(username, username);
    const header = parseLog(await query<Record<string, unknown>>(statement.text, statement.values));
    if (header.result !== "ok") return { status: "unavailable" };
    const headLook = await logLook(header);
    const wanted = personaStatement(username);
    const persona = parsePersona(await query<Record<string, unknown>>(wanted.text, wanted.values));
    const outfits = await readOutfits(username);
    return { status: "ok", data: { header, persona, headLook, outfits } };
  } catch (error) {
    console.error("[adventurer-log] character read failed", error);
    return { status: "unavailable" };
  }
}
