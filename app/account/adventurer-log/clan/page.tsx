import type { Metadata } from "next";
import { redirect } from "next/navigation";

import OwnerNav from "@/components/adventurer-log/OwnerNav";
import InClan, { type TabMember } from "@/components/clans/InClan";
import NoClan from "@/components/clans/NoClan";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { loadAccount } from "@/lib/account/profile-server";
import { requireSession } from "@/lib/account/session-server";
import type { Look } from "@/lib/chathead/look";
import { CURATED_CRESTS, crestName } from "@/lib/clans/crests";
import { type LoadedClan, loadClan } from "@/lib/clans/page-data";
import {
  type ClanInvite,
  clanInvitesForStatement,
  clanInvitesSentStatement,
  clanOfStatement,
  parseClanInvitesFor,
  parseClanInvitesSent,
  parseClanOf,
  type SentInvite,
} from "@/lib/clans/queries";
import type { Rank } from "@/lib/clans/ranks";
import { query } from "@/lib/db";
import { chatheadLooks } from "@/lib/outfits/looks";

export const metadata: Metadata = {
  title: "Your clan",
  description: "Your clan on Zanaris: invitations, members and ranks, notices, and its page.",
};

export const dynamic = "force-dynamic";

type View =
  | { kind: "none"; invites: ClanInvite[] }
  | { kind: "member"; loaded: LoadedClan; myRank: Rank; sent: SentInvite[] };

/**
 * `/account/adventurer-log/clan` - the Clan home: who you're with.
 * - In no clan, it shows the invitations you hold and "Start a clan".
 * - In one, it shows the clan's header and a box for each thing your rank
 *   allows; the Leader gets everything, and Leadership.
 * The database decides every write; this only draws the controls a rank
 * has.
 */
export default async function ClanTab() {
  // Outside any try: requireSession and redirect both work by throwing.
  const session = await requireSession();
  const account = await loadAccount(session);
  if (account.status === "signed_out") redirect("/account/login");
  if (account.status === "unavailable") return <Unavailable />;
  const { username } = account.profile;

  let view: View;
  try {
    const of = clanOfStatement(username);
    const mine = parseClanOf(await query<Record<string, unknown>>(of.text, of.values));
    if (!mine) {
      const wanted = clanInvitesForStatement(username);
      view = { kind: "none", invites: parseClanInvitesFor(await query<Record<string, unknown>>(wanted.text, wanted.values)) };
    } else {
      const loaded = await loadClan(mine.slug);
      if (!loaded) throw new Error(`clan_of named ${mine.slug}, which clan_page does not know`);
      const wanted = clanInvitesSentStatement(username);
      const sent = parseClanInvitesSent(await query<Record<string, unknown>>(wanted.text, wanted.values));
      view = { kind: "member", loaded, myRank: mine.rank, sent };
    }
  } catch (error) {
    console.error("[clans] the clan tab read failed", error);
    return <Unavailable />;
  }

  if (view.kind === "none") {
    const first = CURATED_CRESTS[0];
    return (
      <Frame>
        <OwnerNav title="Your clan" username={username} current="clan" />
        <NoClan invites={view.invites} defaultCrest={first} defaultCrestName={crestName(first)} />
      </Frame>
    );
  }

  const { clan, members, notices } = view.loaded;
  // The roster's chatheads are a nicety: the tab works without them.
  let looks = new Map<string, Look>();
  try {
    looks = await chatheadLooks(members.map((member) => member.username));
  } catch (error) {
    console.error("[clans] roster chatheads failed", error);
  }
  const roster: TabMember[] = members.map((member) => ({ ...member, look: looks.get(member.username) ?? null }));

  return (
    <Frame>
      <OwnerNav title="Your clan" username={username} current="clan" />
      <InClan
        me={username}
        myRank={view.myRank}
        clan={clan}
        crestName={crestName(clan.crest)}
        members={roster}
        notices={notices}
        sent={view.sent}
      />
    </Frame>
  );
}

function Unavailable() {
  return (
    <Frame>
      <TitleBox title="Your clan" links={[{ href: "/account", text: "Account Centre" }]} />
      <Panel>
        <p>Your clan is unavailable right now. Try again shortly.</p>
      </Panel>
    </Frame>
  );
}
