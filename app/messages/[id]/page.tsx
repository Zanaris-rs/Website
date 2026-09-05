import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import MessageView from "@/components/messages/MessageView";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { loadAccount } from "@/lib/account/profile-server";
import { requireSession } from "@/lib/account/session-server";
import {
  type MessageDetail,
  messageStatement,
  parseId,
  parseMessageDetail,
} from "@/lib/messages/queries";
import { query } from "@/lib/db";

export const metadata: Metadata = {
  title: "Message",
  description: "A message in your Zanaris Message Centre.",
};

export const dynamic = "force-dynamic";

/**
 * One message.
 *
 * **Rendering this page marks the message read** — `accounts.message` returns
 * the row and then updates it — which is the only place on the site where a
 * page view is a write. It is the right place for it: opening a message is
 * reading it, and there is nothing else here to press. `force-dynamic` and the
 * absence of any cache header are what keep that honest; a cached render would
 * be a message that never gets marked read and a player whose in-game unread
 * count never goes down.
 *
 * A message belonging to somebody else is a 404, exactly as one that does not
 * exist is: `accounts.message` requires `m.account_id` to be the account the
 * cookie names, and returns no rows either way.
 */
export default async function Message({
  params,
}: PageProps<"/messages/[id]">) {
  const session = await requireSession();
  const loaded = await loadAccount(session);

  if (loaded.status === "signed_out") redirect("/account/login");

  const { id: raw } = await params;
  const id = parseId(raw);
  if (id === null) notFound();

  if (loaded.status === "unavailable") {
    return (
      <Frame>
        <TitleBox title="Message" />
        <Panel>
          <p>The Message Centre is unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  let message: MessageDetail | null = null;
  let failed = false;
  try {
    const wanted = messageStatement(session.u, id);
    const rows = await query<Record<string, unknown>>(
      wanted.text,
      wanted.values,
    );
    message = parseMessageDetail(rows[0]);
  } catch (error) {
    console.error("[messages] read failed", error);
    failed = true;
  }

  if (failed) {
    return (
      <Frame>
        <TitleBox title="Message" />
        <Panel>
          <p>The Message Centre is unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  // Outside the `try`: `notFound()` works by throwing, like `redirect()`.
  if (!message) notFound();

  return (
    <Frame>
      <MessageView message={message} />
    </Frame>
  );
}
