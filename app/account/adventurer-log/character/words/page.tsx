import type { Metadata } from "next";
import { redirect } from "next/navigation";

import CharacterUnavailable from "@/components/adventurer-log/CharacterUnavailable";
import CharacterWords from "@/components/adventurer-log/CharacterWords";
import OwnerNav from "@/components/adventurer-log/OwnerNav";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import { loadCharacterPage } from "@/lib/adventurer-log/character-data";
import { wordsOf } from "@/lib/adventurer-log/persona-input";
import { loadClanOf } from "@/lib/clans/page-data";
import { displayName } from "@/lib/hiscores/format";

export const metadata: Metadata = {
  title: "Character › Words",
  description: "What your adventurer says: overhead chat, and the dialogue visitors click through.",
};

export const dynamic = "force-dynamic";

/** `/account/adventurer-log/character/words` - Character › Words, one Save. */
export default async function CharacterWordsPage() {
  const page = await loadCharacterPage();
  if (page.status === "signed_out") redirect("/account/login");
  if (page.status === "unavailable") return <CharacterUnavailable />;

  const { header, persona, headLook } = page.data;
  // The stage card's Clan row: forgiving, as the log's is - a failed read shows none.
  const clan = await loadClanOf(header.username);
  return (
    <Frame>
      <OwnerNav title="Character" username={header.username} current="character" />
      <Panel align="left" width="100%">
        <CharacterWords
          name={displayName(header.username)}
          username={header.username}
          joinedAt={header.joinedAt}
          persona={persona}
          initial={wordsOf(persona, header.headline)}
          // The header's look is the worn outfit (as on the log page,
          // `page-data.ts`): the only look ever drawn whole.
          outfitLook={header.look}
          headLook={headLook}
          clan={clan}
        />
      </Panel>
    </Frame>
  );
}
