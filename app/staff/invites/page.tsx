import type { Metadata } from "next";
import { redirect } from "next/navigation";

import StaffInvites from "@/components/staff/StaffInvites";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { requireSession } from "@/lib/account/session-server";
import { canonicalizeUsername } from "@/lib/account/validation";
import { query } from "@/lib/db";
import {
  type InviterRow,
  type TreeRow,
  parseInviterRow,
  parseTreeRow,
  staffInviteTreeStatement,
  staffInvitersStatement,
} from "@/lib/invite/queries";
import { loadStaff } from "@/lib/staff/staff-server";

export const metadata: Metadata = {
  title: "Invites",
  description: "Who may invite, and who let whom in, for Zanaris staff.",
};

export const dynamic = "force-dynamic";

/**
 * `/staff/invites?username=bob_smith`. The name is canonicalised the way the
 * login form does it (see `/staff/wealth`): staff accounts with reserved names
 * are exactly the ones a moderator may need to look at.
 */
export default async function StaffInvitesPage({
  searchParams,
}: PageProps<"/staff/invites">) {
  const session = await requireSession();
  const staff = await loadStaff(session);

  if (staff.status === "signed_out" || staff.status === "forbidden") {
    redirect("/account/login");
  }

  if (staff.status === "unavailable") {
    return (
      <Frame>
        <TitleBox title="Invites" />
        <Panel>
          <p>The staff tools are unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  const actor = staff.profile.username;
  const params = await searchParams;
  const raw = Array.isArray(params.username) ? params.username[0] : params.username;

  let username = "";
  let error: string | null = null;
  let tree: TreeRow[] = [];
  let inviters: InviterRow[] = [];

  try {
    const wanted = staffInvitersStatement(actor);
    const rows = await query<Record<string, unknown>>(wanted.text, wanted.values);
    inviters = rows
      .map(parseInviterRow)
      .filter((row): row is InviterRow => row !== null);
  } catch (readError) {
    console.error("[staff] inviters read failed", readError);
    error = "The invite records are unavailable right now. Try again shortly.";
  }

  if (!error && typeof raw === "string" && raw.trim() !== "") {
    const name = canonicalizeUsername(raw);
    if (!name.ok) {
      error =
        name.error === "username_unencodable"
          ? "That is not a name the game can address."
          : "A username is 1 to 12 letters, digits, spaces or underscores.";
    } else {
      username = name.value;
      try {
        const wanted = staffInviteTreeStatement(actor, username);
        const rows = await query<Record<string, unknown>>(wanted.text, wanted.values);
        tree = rows.map(parseTreeRow).filter((row): row is TreeRow => row !== null);
      } catch (readError) {
        console.error("[staff] invite tree read failed", readError);
        error = "The invite records are unavailable right now. Try again shortly.";
      }
    }
  }

  return (
    <Frame>
      <StaffInvites username={username} tree={tree} inviters={inviters} error={error} />
    </Frame>
  );
}
