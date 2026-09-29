import type { Metadata } from "next";
import { redirect } from "next/navigation";

import CharacterSheet from "@/components/adventurer-log/CharacterSheet";
import CharacterUnavailable from "@/components/adventurer-log/CharacterUnavailable";
import OwnerNav from "@/components/adventurer-log/OwnerNav";
import type { SheetClan } from "@/components/clans/SheetClanRow";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import { loadCharacterPage } from "@/lib/adventurer-log/character-data";
import { sheetOf } from "@/lib/adventurer-log/persona-input";
import { readClanOf } from "@/lib/clans/page-data";
import { displayName } from "@/lib/hiscores/format";

export const metadata: Metadata = {
  title: "Character › Sheet",
  description: "Who your adventurer is: title, examine, home town, hangout, god, goals and About.",
};

export const dynamic = "force-dynamic";

/** `/account/adventurer-log/character/sheet` - Character › Sheet, one Save. */
export default async function CharacterSheetPage() {
  const page = await loadCharacterPage();
  if (page.status === "signed_out") redirect("/account/login");
  if (page.status === "unavailable") return <CharacterUnavailable />;

  const { header, persona, headLook } = page.data;
  // The Clan row, and the stage card's. A failed read says so on the row,
  // rather than "Not in a clan"; the stage card, like the log's, just has no
  // Clan row. The rest of the Sheet still works.
  let clan: SheetClan;
  try {
    clan = await readClanOf(header.username);
  } catch (error) {
    console.error("[clans] the Sheet's clan read failed", error);
    clan = "unavailable";
  }
  return (
    <Frame>
      <OwnerNav title="Character" username={header.username} current="character" />
      <Panel align="left" width="100%">
        <CharacterSheet
          name={displayName(header.username)}
          username={header.username}
          joinedAt={header.joinedAt}
          persona={persona}
          // About lives on the log's header (`adventure_log`), and is saved with the sheet.
          initial={sheetOf(persona, header.about)}
          outfitLook={header.look}
          headLook={headLook}
          clan={clan}
        />
      </Panel>
    </Frame>
  );
}
