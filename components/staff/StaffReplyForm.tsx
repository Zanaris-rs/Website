"use client";

import { useState } from "react";

import account from "@/components/account/Account.module.css";
import styles from "@/components/messages/Messages.module.css";
import { BODY_MAX, FIELD_MESSAGES } from "@/lib/messages/format";

import staff from "./Staff.module.css";

/**
 * The moderator's reply box, with the close checkbox next to it.
 *
 * Closing is part of this form rather than a button of its own because
 * `accounts.staff_reply` does both in one call, and because closing a ticket
 * without a word is the rude version of the same action. It is also the only
 * way to write on an already-closed ticket: a plain reply to one is refused,
 * exactly as the player's is, and `close` is what says "I know, and I still
 * have something to say".
 *
 * The reply raises the player's unread count — on the site immediately, and on
 * the game's welcome screen at their next login — so the note under the button
 * says so. A moderator who thinks a reply is silent writes differently.
 */

const MESSAGES: Record<string, string> = {
  ...FIELD_MESSAGES,
  not_found: "That ticket is not there any more.",
  closed: "That ticket is closed. Tick 'close' to write on it anyway.",
  forbidden: "Your account is not staff.",
  session_expired: "You are signed out. Log in again.",
  origin: "That request did not come from this site. Reload the page.",
  unavailable: "The staff inbox is unavailable right now. Try again shortly.",
  bad_request: "Something went wrong sending that. Try again.",
};

type State =
  | { kind: "editing" }
  | { kind: "submitting" }
  | { kind: "failed"; error: string };

export default function StaffReplyForm({
  ticketId,
  ticketOpen,
}: {
  ticketId: number;
  /** A closed ticket starts with `close` ticked: it is the only way to write. */
  ticketOpen: boolean;
}) {
  const [body, setBody] = useState("");
  const [close, setClose] = useState(!ticketOpen);
  const [state, setState] = useState<State>({ kind: "editing" });

  const left = BODY_MAX - body.length;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (state.kind === "submitting") return;

    setState({ kind: "submitting" });
    try {
      const response = await fetch(`/api/staff/tickets/${ticketId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, close }),
      });

      if (response.ok) {
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
        <b>Reply as staff</b>
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

      <div className={staff.closeRow}>
        <input
          id="close-ticket"
          type="checkbox"
          checked={close}
          onChange={(event) => setClose(event.target.checked)}
        />
        <label htmlFor="close-ticket">
          {ticketOpen
            ? "Close the ticket with this reply"
            : "This ticket is closed — send anyway"}
        </label>
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
        This lands in the player&apos;s Message Centre straight away and shows
        as an unread message on the game&apos;s welcome screen at their next
        login. Your account is recorded against it.
      </p>
    </form>
  );
}
