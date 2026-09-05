import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import account from "@/components/account/Account.module.css";
import {
  TICKETS_PER_DAY,
  formatWhen,
  messageKindLabel,
  previewLine,
  ticketKindLabel,
  ticketStatusLabel,
  unreadLabel,
} from "@/lib/messages/format";
import type { MessageSummary, TicketSummary } from "@/lib/messages/queries";

import styles from "./Messages.module.css";

/**
 * The Message Centre: everything addressed to this account, unread first, and
 * the tickets it has open.
 *
 * The order is `accounts.messages`' own — `(read_at IS NULL) DESC, created_at
 * DESC` — and not re-sorted here. That ordering is the one the page is for:
 * somebody who has just been stopped at the login screen opens this to find
 * the ban notice, and it is the first row.
 *
 * A ban or a mute notice is a message like any other and is deliberately not
 * given a box of its own. The account centre already carries the live "Banned
 * until …" line; what this page adds is *why*, in the staff member's own
 * words, and a way to reply.
 */
export default function MessageCentre({
  messages,
  tickets,
}: {
  messages: readonly MessageSummary[];
  tickets: readonly TicketSummary[];
}) {
  const unread = messages.filter((message) => message.readAt === null).length;

  return (
    <>
      <TitleBox
        title="Message Centre"
        links={[{ href: "/account", text: "Account Centre" }]}
      />

      <Panel align="left">
        <div className={account.heading}>
          <b>Messages</b>
          {unread > 0 ? (
            <span className={frame.yellow}> — {unreadLabel(unread)}</span>
          ) : null}
        </div>

        {messages.length === 0 ? (
          <p className={styles.empty}>
            There is nothing in your Message Centre yet. Notices from the staff,
            ban and mute notices, and replies to anything you report all arrive
            here.
          </p>
        ) : (
          <ul className={styles.list}>
            {messages.map((message) => (
              <li key={message.id} className={styles.item}>
                <div className={styles.itemHead}>
                  <a className={frame.link} href={`/messages/${message.id}`}>
                    <span className={styles.subject}>{message.subject}</span>
                  </a>
                  <span className={styles.when}>
                    {formatWhen(message.createdAt)}
                  </span>
                </div>
                <div className={styles.meta}>
                  {messageKindLabel(message.kind)}
                  {message.readAt === null ? (
                    <span className={styles.new}> · New</span>
                  ) : null}
                </div>
                <div className={styles.preview}>
                  {previewLine(message.preview)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel align="left">
        <div className={account.heading}>
          <b>Your tickets</b>
        </div>

        {tickets.length === 0 ? (
          <p className={styles.empty}>
            You have not opened a ticket. Use one to report a bug or to appeal a
            ban — you can open {TICKETS_PER_DAY} a day.
          </p>
        ) : (
          <ul className={styles.list}>
            {tickets.map((ticket) => (
              <li key={ticket.id} className={styles.item}>
                <div className={styles.itemHead}>
                  <a
                    className={frame.link}
                    href={`/messages/tickets/${ticket.id}`}
                  >
                    <span className={styles.subject}>{ticket.subject}</span>
                  </a>
                  <span className={styles.when}>
                    {formatWhen(ticket.updatedAt)}
                  </span>
                </div>
                <div className={styles.meta}>
                  {ticketKindLabel(ticket.kind)} ·{" "}
                  {ticketStatusLabel(ticket.status)}
                  {ticket.unread > 0 ? (
                    <span className={styles.new}>
                      {" "}
                      · {ticket.unread} new{" "}
                      {ticket.unread === 1 ? "reply" : "replies"}
                    </span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className={account.note}>
          <a className={frame.link} href="/messages/new">
            Open a new ticket
          </a>
        </p>
      </Panel>

      <Panel align="left">
        <p className={account.note}>
          Remember: staff will never ask for your password, and nothing sent
          from here will ever ask you to type it into another site.
        </p>
      </Panel>
    </>
  );
}
