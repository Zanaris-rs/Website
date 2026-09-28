import type { Metadata } from "next";
import { redirect } from "next/navigation";

import CharacterLook from "@/components/adventurer-log/CharacterLook";
import CharacterUnavailable from "@/components/adventurer-log/CharacterUnavailable";
import OwnerNav from "@/components/adventurer-log/OwnerNav";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import { loadCharacterPage } from "@/lib/adventurer-log/character-data";
import { loadClanOf } from "@/lib/clans/page-data";
import { displayName } from "@/lib/hiscores/format";

export const metadata: Metadata = {
  title: "Character",
  description: "Your adventurer's look: the outfit you wear, where you stand, and which way you face.",
};

export const dynamic = "force-dynamic";

/**
 * `/account/adventurer-log/character` - Character › Look. Every change here
 * saves at once: `POST /api/outfits/<slot>/default` to wear an outfit, and
 * `POST /api/adventurer-log/persona/stage` for the scene and the facing.
 */
export default async function CharacterLookPage() {
  const page = await loadCharacterPage({ outfits: true });
  if (page.status === "signed_out") redirect("/account/login");
  if (page.status === "unavailable") return <CharacterUnavailable />;

  const { header, persona, headLook, outfits } = page.data;
  // The stage card's Clan row: forgiving, as the log's is - a failed read shows none.
  const clan = await loadClanOf(header.username);
  return (
    <Frame>
      <OwnerNav title="Character" username={header.username} current="character" />
      <Panel align="left" width="100%">
        <CharacterLook
          name={displayName(header.username)}
          username={header.username}
          joinedAt={header.joinedAt}
          headline={header.headline}
          persona={persona}
          initialOutfits={outfits}
          headLook={headLook}
          clan={clan}
        />
      </Panel>
    </Frame>
  );
}
