import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import StaffThread from "@/components/staff/StaffThread";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { requireSession } from "@/lib/account/session-server";
import { type Thread, parseId } from "@/lib/messages/queries";
import { parseStaffThread, staffThreadStatement } from "@/lib/staff/queries";
import { loadStaff } from "@/lib/staff/staff-server";
import { query } from "@/lib/db";

export const metadata: Metadata = {
  title: "Ticket",
  description: "A ticket in the Zanaris staff inbox.",
};

export const dynamic = "force-dynamic";

/**
 * One ticket, as staff see it: the thread with the owner's name on it, and a
 * reply box that can also close it.
 *
 * Nothing here marks anything read. `accounts.staff_thread` has no `UPDATE` in
 * it, unlike the player's `ticket_thread` — the unread flags belong to the
 * player, and a moderator reading a ticket must not clear the notice that
 * tells the player a reply is waiting.
 */
export default async function StaffTicket({
  params,
}: PageProps<"/staff/tickets/[id]">) {
  const session = await requireSession();
  const staff = await loadStaff(session);

  if (staff.status === "signed_out" || staff.status === "forbidden") {
    redirect("/account/login");
  }

  const { id: raw } = await params;
  const id = parseId(raw);
  if (id === null) notFound();

  if (staff.status === "unavailable") {
    return (
      <Frame>
        <TitleBox title="Ticket" />
        <Panel>
          <p>The staff inbox is unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  let ticket: Thread | null = null;
  let failed = false;
  try {
    const wanted = staffThreadStatement(staff.profile.username, id);
    const rows = await query<Record<string, unknown>>(
      wanted.text,
      wanted.values,
    );
    ticket = parseStaffThread(rows);
  } catch (error) {
    console.error("[staff] thread read failed", error);
    failed = true;
  }

  if (failed) {
    return (
      <Frame>
        <TitleBox title="Ticket" />
        <Panel>
          <p>The staff inbox is unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  if (!ticket) notFound();

  return (
    <Frame>
      <StaffThread ticket={ticket} />
    </Frame>
  );
}
