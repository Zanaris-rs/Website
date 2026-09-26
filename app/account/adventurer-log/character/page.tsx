import type { Metadata } from "next";
import { redirect } from "next/navigation";

import CharacterEditor from "@/components/adventurer-log/CharacterEditor";
import OwnerNav from "@/components/adventurer-log/OwnerNav";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { loadAccount } from "@/lib/account/profile-server";
import { requireSession } from "@/lib/account/session-server";
import { logLook } from "@/lib/adventurer-log/page-data";
import { type Persona, parsePersona, personaStatement } from "@/lib/adventurer-log/persona";
import { editablePersona } from "@/lib/adventurer-log/persona-input";
import { type LogHeader, logStatement, parseLog } from "@/lib/adventurer-log/queries";
import type { Look } from "@/lib/chathead/look";
import { displayName } from "@/lib/hiscores/format";
import { query } from "@/lib/db";

export const metadata: Metadata = {
  title: "Your character",
  description: "Who your adventurer is on your Adventurer Log: what they say, and how.",
};

export const dynamic = "force-dynamic";

/**
 * `/account/adventurer-log/character` - the owner's persona: the headline as
 * overhead chat, the character sheet, the signature emote and the dialogue,
 * with the log's own card and dialogue box drawing the unsaved draft beside
 * them. One Save (`/api/adventurer-log/persona`).
 */
export default async function CharacterPage() {
  const session = await requireSession();
  const loaded = await loadAccount(session);

  if (loaded.status === "signed_out") redirect("/account/login");
  if (loaded.status === "unavailable") return <Unavailable />;

  const { username } = loaded.profile;
  let header: LogHeader;
  let persona: Persona;
  let headLook: Look | null = null;
  try {
    const statement = logStatement(username, username);
    header = parseLog(await query<Record<string, unknown>>(statement.text, statement.values));
    if (header.result === "ok") headLook = await logLook(header);
    // Unlike the log page, a failed read is not an empty persona here: the
    // editor would start blank, and its Save would write the blank over them.
    const wanted = personaStatement(username);
    persona = parsePersona(await query<Record<string, unknown>>(wanted.text, wanted.values));
  } catch (error) {
    console.error("[adventurer-log] character read failed", error);
    return <Unavailable />;
  }
  if (header.result !== "ok") return <Unavailable />;

  return (
    <Frame>
      <OwnerNav title="Your character" username={username} current="character" />
      <Panel align="left" width="100%">
        <CharacterEditor
          // A pick the site no longer lists starts as none, or every Save is refused.
          initial={editablePersona({ ...persona, headline: header.headline })}
          name={displayName(header.username)}
          username={header.username}
          joinedAt={header.joinedAt}
          // The header's look is the default outfit (as on the log page,
          // `page-data.ts`): the only look ever drawn whole.
          outfitLook={header.look}
          headLook={headLook}
        />
      </Panel>
    </Frame>
  );
}

function Unavailable() {
  return (
    <Frame>
      <TitleBox title="Your character" links={[{ href: "/account", text: "Account Centre" }]} />
      <Panel>
        <p>Your character is unavailable right now. Try again shortly.</p>
      </Panel>
    </Frame>
  );
}
