import type { Metadata } from "next";
import { redirect } from "next/navigation";

import InvitesPanel from "@/components/invite/InvitesPanel";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { formatWhen } from "@/lib/account/profile";
import { loadAccount } from "@/lib/account/profile-server";
import { requireSession } from "@/lib/account/session-server";
import { query } from "@/lib/db";
import {
  type Citizen,
  type InviteRow,
  citizenStatement,
  invitesStatement,
  parseCitizen,
  parseInviteRow,
} from "@/lib/invite/queries";
import { inviteView } from "@/lib/invite/view";

export const metadata: Metadata = {
  title: "Invite links",
  description: "The links you have made to bring people into Zanaris.",
};

export const dynamic = "force-dynamic";

/**
 * `/account/invites` — your links, and a button to make another.
 *
 * Every account can reach this page, but only an account staff have switched
 * on can make links; for everybody else it says so, and still lists the links
 * the account made while it could, so a player can see who they brought in.
 */
export default async function Invites() {
  const session = await requireSession();
  const loaded = await loadAccount(session);

  if (loaded.status === "signed_out") redirect("/account/login");
  if (loaded.status === "unavailable") return <Unavailable />;

  let citizen: Citizen | null = null;
  let rows: InviteRow[] = [];
  try {
    const wanted = citizenStatement(loaded.profile.username);
    const header = await query<Record<string, unknown>>(wanted.text, wanted.values);
    citizen = parseCitizen(header[0]);

    const list = invitesStatement(loaded.profile.username);
    const answered = await query<Record<string, unknown>>(list.text, list.values);
    rows = answered
      .map(parseInviteRow)
      .filter((row): row is InviteRow => row !== null);
  } catch (error) {
    console.error("[invites] read failed", error);
    return <Unavailable />;
  }

  if (!citizen) return <Unavailable />;

  return (
    <Frame>
      <InvitesPanel
        citizen={citizen}
        invites={rows.map((row) => inviteView(row, formatWhen))}
      />
    </Frame>
  );
}

function Unavailable() {
  return (
    <Frame>
      <TitleBox title="Invite links" />
      <Panel>
        <p>Invite links are unavailable right now. Try again shortly.</p>
      </Panel>
    </Frame>
  );
}
