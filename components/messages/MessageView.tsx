import account from "@/components/account/Account.module.css";
import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { formatWhen, messageKindLabel } from "@/lib/messages/format";
import type { MessageDetail } from "@/lib/messages/queries";

import styles from "./Messages.module.css";

/**
 * One message, with its body.
 *
 * It is already marked read by the time this renders — `accounts.message`
 * returns the row and then updates it — but the `read_at` it returned is the
 * value from *before* that update, so this page can honestly say "New" the one
 * time it is true and never again.
 *
 * The body is rendered as pre-wrapped plain text. It is never parsed as
 * Markdown or HTML: these bodies are written by players and by the engine's
 * ban handler, and neither is authoring a document. React escapes what it
 * renders, so a `<b>` in a ban notice is shown, not obeyed.
 */
export default function MessageView({ message }: { message: MessageDetail }) {
  return (
    <>
      <TitleBox
        title="Message"
        links={[
          { href: "/messages", text: "Message Centre" },
          { href: "/account", text: "Account Centre" },
        ]}
      />

      <Panel align="left">
        <div className={styles.messageHead}>
          <div className={styles.subject}>{message.subject}</div>
          <div className={styles.meta}>
            {messageKindLabel(message.kind)} · {formatWhen(message.createdAt)}
            {message.readAt === null ? (
              <span className={styles.new}> · New</span>
            ) : null}
          </div>
        </div>

        <div className={styles.body}>{message.body}</div>

        {message.ticketId !== null ? (
          <p className={account.note}>
            <a
              className={frame.link}
              href={`/messages/tickets/${message.ticketId}`}
            >
              Open the whole ticket
            </a>{" "}
            to read the thread and reply.
          </p>
        ) : null}
      </Panel>
    </>
  );
}
