import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import OwnerNav from "@/components/adventurer-log/OwnerNav";
import AccountOutfitEditor from "@/components/outfits/AccountOutfitEditor";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { loadAccount } from "@/lib/account/profile-server";
import { requireSession } from "@/lib/account/session-server";
import { outfitSlotFrom } from "@/lib/adventurer-log/href";
import type { SavedOutfits } from "@/lib/chathead/outfit-store";
import { readOutfits } from "@/lib/outfits/route";

export const metadata: Metadata = {
  title: "Edit an outfit",
  description: "Dress your adventurer: what they wear, their body and its colours.",
};

export const dynamic = "force-dynamic";

/**
 * `/account/adventurer-log/character/outfit/<1-10>` - the outfit editor for
 * one slot, reached from Character › Look. Anything but 1 to 10 is a 404.
 * `?import=1` (Look's "Import your in-game look") imports the game's look
 * as it opens. Everything after the first read goes through `/api/outfits`.
 */
export default async function OutfitEditorPage({
  params,
  searchParams,
}: PageProps<"/account/adventurer-log/character/outfit/[slot]">) {
  const slot = outfitSlotFrom((await params).slot);
  if (slot === null) notFound();
  const importOnLoad = (await searchParams).import === "1";

  const session = await requireSession();
  const loaded = await loadAccount(session);
  if (loaded.status === "signed_out") redirect("/account/login");
  if (loaded.status === "unavailable") return <Unavailable />;

  let initial: SavedOutfits;
  try {
    initial = await readOutfits(loaded.profile.username);
  } catch (error) {
    console.error("[outfits] account read failed", error);
    return <Unavailable />;
  }

  return (
    <Frame>
      <OwnerNav title="Character" username={loaded.profile.username} current="character" />
      <Panel align="left" width="100%">
        <AccountOutfitEditor slot={slot} initial={initial} importOnLoad={importOnLoad} />
      </Panel>
    </Frame>
  );
}

function Unavailable() {
  return (
    <Frame>
      <TitleBox title="Character" links={[{ href: "/account", text: "Account Centre" }]} />
      <Panel>
        <p>Outfits are unavailable right now. Try again shortly.</p>
      </Panel>
    </Frame>
  );
}
