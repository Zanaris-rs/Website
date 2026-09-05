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
import type { InboxRow, InboxStatus } from "@/lib/staff/queries";
import { INBOX_STATUSES } from "@/lib/staff/queries";

import staff from "./Staff.module.css";

/**
 * The staff inbox: every ticket in the chosen state, newest activity first.
 *
 * `awaiting_staff` — the newest message on the ticket is the player's — is the
 * only ordering moderators actually want, so it is the first column and it is
 * the one thing on the row painted yellow. The list itself stays in the
 * function's `updated_at DESC` order rather than being re-sorted here: a queue
 * that reorders itself between visits is a queue people lose their place in.
 *
 * The three filters are plain links with a `?status=`, not a client-side
 * control. A moderator's back button then works, and a link to "the closed
 * ones" can be pasted to somebody else.
 */

const FILTER_LABELS: Record<InboxStatus, string> = {
  open: "Open",
  closed: "Closed",
  all: "All",
};

export default function StaffInbox({
  tickets,
  status,
  username,
}: {
  tickets: readonly InboxRow[];
  status: InboxStatus;
  username: string;
}) {
  const waiting = tickets.filter((ticket) => ticket.awaitingStaff).length;

  return (
    <>
      <TitleBox
        title="Staff inbox"
        links={[
          { href: "/staff/notice", text: "Send a notice" },
          { href: "/staff/reports", text: "Reports" },
          { href: "/account", text: "Account Centre", br: true },
        ]}
      />

      <Panel align="left">
        <div className={account.heading}>
          <b>Tickets</b>
          {waiting > 0 ? (
            <span className={frame.yellow}> — {waiting} awaiting a reply</span>
          ) : null}
        </div>

        <div className={styles.filters}>
          {INBOX_STATUSES.map((option, index) => (
            <span key={option}>
              {index > 0 ? " · " : null}
              {option === status ? (
                <span className={styles.filterCurrent}>
                  {FILTER_LABELS[option]}
                </span>
              ) : (
                <a className={frame.link} href={`/staff?status=${option}`}>
                  {FILTER_LABELS[option]}
                </a>
              )}
            </span>
          ))}
        </div>

        {tickets.length === 0 ? (
          <p className={styles.empty}>
            No {status === "all" ? "" : `${status} `}tickets.
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Updated</th>
                <th>Player</th>
                <th>Kind</th>
                <th>Subject</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td className={styles.when}>{formatWhen(ticket.updatedAt)}</td>
                  <td className={staff.name}>
                    {toDisplayName(ticket.username)}
                  </td>
                  <td>{ticketKindLabel(ticket.kind)}</td>
                  <td>
                    <a className={frame.link} href={`/staff/tickets/${ticket.id}`}>
                      {ticket.subject}
                    </a>
                  </td>
                  <td className={ticket.awaitingStaff ? styles.awaiting : ""}>
                    {ticket.awaitingStaff
                      ? "Awaiting staff"
                      : ticketStatusLabel(ticket.status)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className={account.note}>
          Signed in as {toDisplayName(username)}. Everything you send from here
          is written to the audit log with your account against it.
        </p>
      </Panel>
    </>
  );
}
