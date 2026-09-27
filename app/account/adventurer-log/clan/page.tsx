import type { Metadata } from "next";
import { redirect } from "next/navigation";

import OwnerNav from "@/components/adventurer-log/OwnerNav";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { loadAccount } from "@/lib/account/profile-server";
import { requireSession } from "@/lib/account/session-server";

export const metadata: Metadata = { title: "Your clan" };

export const dynamic = "force-dynamic";

/** `/account/adventurer-log/clan` - the Clan tab, until clans arrive with it. */
export default async function ClanTabPage() {
  const session = await requireSession();
  const loaded = await loadAccount(session);
  if (loaded.status === "signed_out") redirect("/account/login");
  if (loaded.status === "unavailable") {
    return (
      <Frame>
        <TitleBox title="Clan" links={[{ href: "/account", text: "Account Centre" }]} />
        <Panel>
          <p>Clans are unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }
  return (
    <Frame>
      <OwnerNav title="Clan" username={loaded.profile.username} current="clan" />
      <Panel>
        <p>Clans are on their way: start one, invite your friends, and give them ranks.</p>
      </Panel>
    </Frame>
  );
}
