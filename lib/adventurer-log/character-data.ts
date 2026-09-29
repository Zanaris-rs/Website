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
 * What every Character tab reads: the log's header first (the name, About,
 * the worn outfit's look, and whether there is a log at all),
 * then, together, the chathead's look, the persona and - for the Look tab,
 * which shows them - the ten outfits. Those need only the header, not each
 * other, so they go at once, as the staff report page's reads do: the pool
 * has two connections.
 *
 * Unlike the log page, a failed persona read is not an empty persona here:
 * a tab would start blank, and its Save would write the blank over it. The
 * page shows "unavailable" instead.
 */

export type CharacterData<Outfits extends SavedOutfits | null = SavedOutfits | null> = {
  header: LogHeader & { result: "ok" };
  persona: Persona;
  /** The chathead's look: the worn outfit, else the game's head-only look. */
  headLook: Look | null;
  /** The ten outfits, when asked for (`{ outfits: true }`); null otherwise. */
  outfits: Outfits;
};

export type CharacterPage<Outfits extends SavedOutfits | null = SavedOutfits | null> =
  | { status: "signed_out" }
  | { status: "unavailable" }
  | { status: "ok"; data: CharacterData<Outfits> };

/** The signed-in owner's character, with their outfits when asked, or why there is none to show. */
export function loadCharacterPage(read: { outfits: true }): Promise<CharacterPage<SavedOutfits>>;
export function loadCharacterPage(read?: { outfits?: false }): Promise<CharacterPage<null>>;
export async function loadCharacterPage(read: { outfits?: boolean } = {}): Promise<CharacterPage> {
  // Outside any try: it redirects a reader with no session, by throwing.
  const session = await requireSession();
  const loaded = await loadAccount(session);
  if (loaded.status !== "ok") return { status: loaded.status };

  const { username } = loaded.profile;
  try {
    const statement = logStatement(username, username);
    const header = parseLog(await query<Record<string, unknown>>(statement.text, statement.values));
    if (header.result !== "ok") return { status: "unavailable" };
    const wanted = personaStatement(username);
    const [headLook, persona, outfits] = await Promise.all([
      logLook(header),
      query<Record<string, unknown>>(wanted.text, wanted.values).then((rows) => parsePersona(rows)),
      read.outfits ? readOutfits(username) : null,
    ]);
    return { status: "ok", data: { header, persona, headLook, outfits } };
  } catch (error) {
    console.error("[adventurer-log] character read failed", error);
    return { status: "unavailable" };
  }
}
