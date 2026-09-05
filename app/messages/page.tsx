import type { Metadata } from "next";
import { redirect } from "next/navigation";

import MessageCentre from "@/components/messages/MessageCentre";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { loadAccount } from "@/lib/account/profile-server";
import { requireSession } from "@/lib/account/session-server";
import {
  type MessageSummary,
  type TicketSummary,
  messagesStatement,
  parseMessageSummary,
  parseTicketSummary,
  ticketsStatement,
} from "@/lib/messages/queries";
import { query } from "@/lib/db";

export const metadata: Metadata = {
  title: "Message Centre",
  description:
    "Notices from the Zanaris staff, ban and mute notices, and your own tickets.",
};

/** Reads a cookie and a live inbox: never prerendered, never cached. */
export const dynamic = "force-dynamic";

/**
 * The Message Centre, replacing Part 1's placeholder.
 *
 * Both reads are keyed by the username out of the signed cookie and go through
 * functions the `website` role can only `EXECUTE` — it holds no `SELECT` on
 * `account_message` or `ticket` — so there is no id on this page that anybody
 * could tamper with into somebody else's inbox.
 *
 * `loadAccount` runs first and decides whether the cookie is still good: no row
 * (the account is gone) or a moved salt (the password was changed on another
 * device) both mean signed out. Its verdict is returned rather than
 * redirected, which is what lets every `redirect()` here sit outside a `try` —
 * it works by throwing, and a `catch` would swallow it and render a signed-in
 * page to somebody who is not.
 *
 * A banned account reaches this page, deliberately. It is exactly the page
 * somebody who cannot log in to the game needs.
 */
export default async function Messages() {
  const session = await requireSession();
  const loaded = await loadAccount(session);

  if (loaded.status === "signed_out") redirect("/account/login");

  if (loaded.status === "unavailable") {
    return (
      <Frame>
        <TitleBox title="Message Centre" />
        <Panel>
          <p>The Message Centre is unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  let messages: MessageSummary[] = [];
  let tickets: TicketSummary[] = [];
  let failed = false;

  try {
    const wanted = messagesStatement(session.u);
    const rows = await query<Record<string, unknown>>(
      wanted.text,
      wanted.values,
    );
    messages = rows
      .map(parseMessageSummary)
      .filter((message): message is MessageSummary => message !== null);
  } catch (error) {
    console.error("[messages] list read failed", error);
    failed = true;
  }

  // The tickets are a second panel, not a second page: if that one read fails
  // the messages above it are still worth showing, so it degrades on its own.
  try {
    const wanted = ticketsStatement(session.u);
    const rows = await query<Record<string, unknown>>(
      wanted.text,
      wanted.values,
    );
    tickets = rows
      .map(parseTicketSummary)
      .filter((ticket): ticket is TicketSummary => ticket !== null);
  } catch (error) {
    console.error("[messages] ticket list read failed", error);
  }

  if (failed) {
    return (
      <Frame>
        <TitleBox title="Message Centre" />
        <Panel>
          <p>The Message Centre is unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  return (
    <Frame>
      <MessageCentre messages={messages} tickets={tickets} />
    </Frame>
  );
}
