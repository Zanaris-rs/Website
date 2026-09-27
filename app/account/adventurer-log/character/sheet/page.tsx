import type { Metadata } from "next";
import { redirect } from "next/navigation";

import CharacterSheet from "@/components/adventurer-log/CharacterSheet";
import CharacterUnavailable from "@/components/adventurer-log/CharacterUnavailable";
import OwnerNav from "@/components/adventurer-log/OwnerNav";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import { loadCharacterPage } from "@/lib/adventurer-log/character-data";
import { sheetOf } from "@/lib/adventurer-log/persona-input";
import { loadClanOf } from "@/lib/clans/page-data";
import { displayName } from "@/lib/hiscores/format";

export const metadata: Metadata = {
  title: "Character › Sheet",
  description: "Who your adventurer is: title, examine, home town, hangout, god and goals.",
};

export const dynamic = "force-dynamic";

/** `/account/adventurer-log/character/sheet` - Character › Sheet, one Save. */
export default async function CharacterSheetPage() {
  const page = await loadCharacterPage();
  if (page.status === "signed_out") redirect("/account/login");
  if (page.status === "unavailable") return <CharacterUnavailable />;

  const { header, persona, headLook } = page.data;
  // The Clan row, and the stage card's: forgiving, as the log's is - a failed read shows no clan.
  const clan = await loadClanOf(header.username);
  return (
    <Frame>
      <OwnerNav title="Character" username={header.username} current="character" />
      <Panel align="left" width="100%">
        <CharacterSheet
          name={displayName(header.username)}
          username={header.username}
          joinedAt={header.joinedAt}
          headline={header.headline}
          persona={persona}
          initial={sheetOf(persona)}
          outfitLook={header.look}
          headLook={headLook}
          clan={clan}
        />
      </Panel>
    </Frame>
  );
}
