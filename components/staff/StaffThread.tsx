import account from "@/components/account/Account.module.css";
import styles from "@/components/messages/Messages.module.css";
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
import { staffLinks } from "@/lib/staff/links";

import StaffReplyForm from "./StaffReplyForm";

/**
 * A ticket as staff see it.
 *
 * The same thread the player sees, with two differences that both matter:
 * the owner's name is on it, and **nothing here marks anything read**.
 * `accounts.staff_thread` deliberately has no `UPDATE` in it — the unread
 * flags belong to the player, and a moderator opening a ticket must not
 * quietly clear the notice telling the player there is a reply waiting.
 */
export default function StaffThread({ ticket }: { ticket: Thread }) {
  const owner = ticket.username ?? "";

  return (
    <>
      <TitleBox
        title="Ticket"
        links={staffLinks()}
      />

      <Panel align="left">
        <div className={styles.messageHead}>
          <div className={styles.subject}>{ticket.subject}</div>
          <div className={styles.meta}>
            {ticketKindLabel(ticket.kind)} · {ticketStatusLabel(ticket.status)}{" "}
            · opened {formatWhen(ticket.createdAt)} by{" "}
            {owner === "" ? "an account that is gone" : toDisplayName(owner)}
          </div>
          {owner === "" ? null : (
            <div className={styles.meta}>
              <a
                className={frame.link}
                href={`/hiscores/player/${encodeURIComponent(owner)}`}
              >
                Hiscores for {toDisplayName(owner)}
              </a>
            </div>
          )}
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
                  {message.author === ""
                    ? "unknown"
                    : toDisplayName(message.author)}
                  {message.fromStaff ? " (staff)" : ""} ·{" "}
                  {formatWhen(message.createdAt)}
                </div>
                <div className={styles.body}>{message.body}</div>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel align="left">
        <StaffReplyForm
          ticketId={ticket.id}
          ticketOpen={ticket.status === "open"}
        />
        <p className={account.note}>
          A ban or a mute is still a game command — this replies to the ticket
          and nothing else.
        </p>
      </Panel>
    </>
  );
}
