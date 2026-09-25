import type { Metadata } from "next";
import { redirect } from "next/navigation";

import OwnerNav from "@/components/adventurer-log/OwnerNav";
import AccountOutfits from "@/components/outfits/AccountOutfits";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import type { SavedOutfits } from "@/lib/chathead/outfit-store";
import { loadAccount } from "@/lib/account/profile-server";
import { requireSession } from "@/lib/account/session-server";
import { readOutfits } from "@/lib/outfits/route";

export const metadata: Metadata = {
  title: "Outfits",
  description: "Dress your character, and choose the chathead that is your picture.",
};

export const dynamic = "force-dynamic";

/**
 * `/account/adventurer-log/outfits` — fashionscape. Up to ten outfits, one of
 * them the player's picture; everything after the first read goes through
 * `/api/outfits`.
 */
export default async function Outfits() {
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
      <OwnerNav title="Outfits" username={loaded.profile.username} current="outfits" />
      <Panel width="100%">
        <p>
          The outfit you choose as your picture is your chathead on your
          Adventurer Log. Until you choose one, the log shows how you looked
          the last time the game saved you. Every outfit you save is on show
          in the Wardrobe on your log.
        </p>
        <AccountOutfits initial={initial} />
      </Panel>
    </Frame>
  );
}

function Unavailable() {
  return (
    <Frame>
      <TitleBox
        title="Outfits"
        links={[{ href: "/account", text: "Account Centre" }]}
      />
      <Panel>
        <p>Outfits are unavailable right now. Try again shortly.</p>
      </Panel>
    </Frame>
  );
}
