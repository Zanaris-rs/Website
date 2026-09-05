"use client";

import { useState } from "react";

import account from "@/components/account/Account.module.css";
import frame from "@/components/site/Frame.module.css";
import { BODY_MAX, FIELD_MESSAGES, REPLIES_PER_HOUR } from "@/lib/messages/format";

import styles from "./Messages.module.css";

/**
 * The reply box at the bottom of a ticket.
 *
 * No Turnstile: the gate is a session, and the rate limit lives in SQL where
 * this side can neither read nor reset it — twenty of the player's own
 * messages an hour, counted on `from_staff = false` rows only, so a staff
 * reply never spends the allowance.
 *
 * On success the page is reloaded rather than the new message being spliced in
 * client-side. The thread is server-rendered from `accounts.ticket_thread`,
 * which is also what marks the staff replies read; re-fetching it is both
 * simpler and the only way to be sure the page shows what the database
 * actually holds.
 */

const MESSAGES: Record<string, string> = {
  ...FIELD_MESSAGES,
  not_found: "That ticket is not there any more.",
  closed: "This ticket is closed. Open a new one if you still need help.",
  rate_limited: `You have sent ${REPLIES_PER_HOUR} messages in the last hour. Wait a little.`,
  session_expired: "You are signed out. Log in again.",
  origin: "That request did not come from this site. Reload the page.",
  unavailable: "The Message Centre is unavailable right now. Try again shortly.",
  bad_request: "Something went wrong sending that. Try again.",
};

type State =
  | { kind: "editing" }
  | { kind: "submitting" }
  | { kind: "failed"; error: string };

export default function TicketReplyForm({ ticketId }: { ticketId: number }) {
  const [body, setBody] = useState("");
  const [state, setState] = useState<State>({ kind: "editing" });

  const left = BODY_MAX - body.length;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (state.kind === "submitting") return;

    setState({ kind: "submitting" });
    try {
      const response = await fetch(`/api/tickets/${ticketId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });

      if (response.ok) {
        // A full reload, not a router refresh: the thread is a server render
        // whose read side-effect has to run again.
        window.location.reload();
        return;
      }

      const payload: unknown = await response.json().catch(() => null);
      const code = (payload as { error?: string } | null)?.error ?? "unavailable";
      setState({
        kind: "failed",
        error: MESSAGES[code] ?? "The reply could not be sent. Try again.",
      });
    } catch {
      setState({ kind: "failed", error: MESSAGES.unavailable });
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className={account.heading}>
        <b>Reply</b>
      </div>

      <textarea
        className={styles.textarea}
        value={body}
        maxLength={BODY_MAX}
        required
        aria-label="Your reply"
        onChange={(event) => setBody(event.target.value)}
      />
      <div className={`${styles.counter} ${left < 0 ? styles.counterOver : ""}`}>
        {left} characters left
      </div>

      {state.kind === "failed" && (
        <p className={account.error} role="alert">
          {state.error}
        </p>
      )}

      <div className={account.actions}>
        <button
          className={account.submit}
          type="submit"
          disabled={state.kind === "submitting" || body.trim().length === 0}
        >
          {state.kind === "submitting" ? "Sending..." : "Send reply"}
        </button>
      </div>

      <p className={account.note}>
        Staff read these by hand, so a reply may take a while. You will get a
        message here — and an unread count on the game&apos;s welcome screen —
        when one arrives. <a className={frame.link} href="/messages">Back to
        the Message Centre</a>.
      </p>
    </form>
  );
}
