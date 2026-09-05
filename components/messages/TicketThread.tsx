import account from "@/components/account/Account.module.css";
import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { toDisplayName } from "@/lib/base37";
import {
  formatWhen,
  ticketKindLabel,
  ticketStatusLabel,
} from "@/lib/messages/format";
import type { Thread } from "@/lib/messages/queries";

import TicketReplyForm from "./TicketReplyForm";
import styles from "./Messages.module.css";

/**
 * One ticket, as the player who opened it sees it: the whole thread oldest
 * first, and a reply box while it is open.
 *
 * Rendering it is what marks the staff replies on this ticket read — the read
 * happens in `accounts.ticket_thread`, not here — so the unread count in the
 * game goes down when the reply has actually been opened and not before.
 *
 * A closed ticket keeps its thread and loses its reply box. Reopening is not
 * offered: `accounts.ticket_reply` refuses a closed ticket, and a box that
 * always failed would be worse than a sentence saying so.
 */
export default function TicketThread({ ticket }: { ticket: Thread }) {
  const open = ticket.status === "open";

  return (
    <>
      <TitleBox
        title="Ticket"
        links={[
          { href: "/messages", text: "Message Centre" },
          { href: "/messages/new", text: "New ticket" },
        ]}
      />

      <Panel align="left">
        <div className={styles.messageHead}>
          <div className={styles.subject}>{ticket.subject}</div>
          <div className={styles.meta}>
            {ticketKindLabel(ticket.kind)} ·{" "}
            {ticketStatusLabel(ticket.status)} · opened{" "}
            {formatWhen(ticket.createdAt)}
          </div>
        </div>

        <div className={styles.thread}>
          {ticket.messages.length === 0 ? (
            <p className={styles.empty}>This ticket has no messages.</p>
          ) : (
            ticket.messages.map((message) => (
              <div key={message.id} className={styles.message}>
                <div
                  className={`${styles.author} ${
                    message.fromStaff ? styles.fromStaff : ""
                  }`}
                >
                  {message.fromStaff ? "Zanaris staff" : "You"}
                  {message.fromStaff && message.author !== ""
                    ? ` (${toDisplayName(message.author)})`
                    : ""}{" "}
                  · {formatWhen(message.createdAt)}
                </div>
                <div className={styles.body}>{message.body}</div>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel align="left">
        {open ? (
          <TicketReplyForm ticketId={ticket.id} />
        ) : (
          <>
            <p>
              This ticket is closed. If the problem is still there,{" "}
              <a className={frame.link} href="/messages/new">
                open a new one
              </a>
              .
            </p>
            <p className={account.note}>
              <a className={frame.link} href="/messages">
                Back to the Message Centre
              </a>
            </p>
          </>
        )}
      </Panel>
    </>
  );
}
