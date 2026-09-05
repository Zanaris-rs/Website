import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import TicketThread from "@/components/messages/TicketThread";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { loadAccount } from "@/lib/account/profile-server";
import { requireSession } from "@/lib/account/session-server";
import {
  type Thread,
  parseId,
  parseThread,
  ticketThreadStatement,
} from "@/lib/messages/queries";
import { query } from "@/lib/db";

export const metadata: Metadata = {
  title: "Ticket",
  description: "A ticket you opened with the Zanaris staff.",
};

export const dynamic = "force-dynamic";

/**
 * One of the player's own tickets: the thread, and a reply box while it is
 * open.
 *
 * This page is the one thing the plan's page table does not list, and the
 * verification list needs it: "the player sees the reply" has to happen
 * somewhere, and the two neighbouring pages cannot do it. `/messages/[id]`
 * shows a single `account_message` — the reply notice, not the conversation it
 * belongs to — and `/staff/tickets/[id]` is the moderator's view of the same
 * thread, which a player must not reach. So the route the plan *does* list,
 * `GET /api/tickets/[id]`, gets the page it implies, mirroring
 * `/staff/tickets/[id]` on the other side.
 *
 * **Rendering it marks this ticket's replies read**, the same way
 * `/messages/[id]` does, because `accounts.ticket_thread` updates them. Hence
 * `force-dynamic` and no cache header.
 */
export default async function Ticket({
  params,
}: PageProps<"/messages/tickets/[id]">) {
  const session = await requireSession();
  const loaded = await loadAccount(session);

  if (loaded.status === "signed_out") redirect("/account/login");

  const { id: raw } = await params;
  const id = parseId(raw);
  if (id === null) notFound();

  if (loaded.status === "unavailable") {
    return (
      <Frame>
        <TitleBox title="Ticket" />
        <Panel>
          <p>The Message Centre is unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  let ticket: Thread | null = null;
  let failed = false;
  try {
    const wanted = ticketThreadStatement(session.u, id);
    const rows = await query<Record<string, unknown>>(
      wanted.text,
      wanted.values,
    );
    ticket = parseThread(rows);
  } catch (error) {
    console.error("[messages] ticket thread read failed", error);
    failed = true;
  }

  if (failed) {
    return (
      <Frame>
        <TitleBox title="Ticket" />
        <Panel>
          <p>The Message Centre is unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  // A ticket somebody else owns returns no rows, exactly as a missing one
  // does. Outside the `try`, because `notFound()` throws.
  if (!ticket) notFound();

  return (
    <Frame>
      <TicketThread ticket={ticket} />
    </Frame>
  );
}
