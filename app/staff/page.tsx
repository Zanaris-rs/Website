import type { Metadata } from "next";
import { redirect } from "next/navigation";

import StaffInbox from "@/components/staff/StaffInbox";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { requireSession } from "@/lib/account/session-server";
import {
  type InboxRow,
  parseInboxRow,
  parseInboxStatus,
  staffInboxStatement,
} from "@/lib/staff/queries";
import { loadStaff } from "@/lib/staff/staff-server";
import { query } from "@/lib/db";

export const metadata: Metadata = {
  title: "Staff inbox",
  description: "Tickets waiting for the Zanaris staff.",
};

export const dynamic = "force-dynamic";

/**
 * The staff inbox.
 *
 * **A signed-in player who is not staff is redirected to the login form, not
 * shown a 403.** That is deliberate: a 403 page confirms the URL is real and
 * that the reader simply lacks the level, which is a small piece of
 * reconnaissance handed out for free. Redirecting makes `/staff` look the same
 * to a player as it does to a stranger.
 *
 * The level itself is read from `accounts.profile` on this request and never
 * from the cookie, and `accounts.staff_inbox` re-checks it in its own `WHERE`
 * clause, so the queue is empty for a non-staff actor even if this page were
 * wrong.
 */
export default async function Staff({ searchParams }: PageProps<"/staff">) {
  const session = await requireSession();
  const staff = await loadStaff(session);

  if (staff.status === "signed_out" || staff.status === "forbidden") {
    redirect("/account/login");
  }

  if (staff.status === "unavailable") {
    return (
      <Frame>
        <TitleBox title="Staff inbox" />
        <Panel>
          <p>The staff inbox is unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  const params = await searchParams;
  const status = parseInboxStatus(
    Array.isArray(params.status) ? params.status[0] : params.status,
  );

  let tickets: InboxRow[] = [];
  let failed = false;
  try {
    const wanted = staffInboxStatement(staff.profile.username, status);
    const rows = await query<Record<string, unknown>>(
      wanted.text,
      wanted.values,
    );
    tickets = rows
      .map(parseInboxRow)
      .filter((ticket): ticket is InboxRow => ticket !== null);
  } catch (error) {
    console.error("[staff] inbox read failed", error);
    failed = true;
  }

  if (failed) {
    return (
      <Frame>
        <TitleBox title="Staff inbox" />
        <Panel>
          <p>The staff inbox is unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  return (
    <Frame>
      <StaffInbox
        tickets={tickets}
        status={status}
        username={staff.profile.username}
      />
    </Frame>
  );
}
