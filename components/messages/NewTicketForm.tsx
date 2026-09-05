"use client";

import { useState } from "react";

import account from "@/components/account/Account.module.css";
import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import {
  BODY_MAX,
  FIELD_MESSAGES,
  SUBJECT_MAX,
  TICKETS_PER_DAY,
  TICKET_KINDS,
  type TicketKind,
  ticketKindLabel,
} from "@/lib/messages/format";

import styles from "./Messages.module.css";

/**
 * Open a ticket: a kind, a subject, a body, and the hint that decides whether
 * the ticket is worth anything.
 *
 * The hint is the point of this page. A bug report that says "it broke" costs
 * a moderator a round trip and a player a day of waiting; one that names the
 * world, the time, what they did and what happened can usually be acted on
 * without a reply at all. It is the same four things the welcome message asks
 * for, deliberately worded the same way.
 *
 * No Turnstile here either: the gate is a session and the cap is in SQL —
 * five tickets per account per day, which only the database can count.
 */

const MESSAGES: Record<string, string> = {
  ...FIELD_MESSAGES,
  kind_invalid: "Choose what the ticket is about.",
  rate_limited: `You have opened ${TICKETS_PER_DAY} tickets today. Try again tomorrow, or reply to one you already have.`,
  invalid: "That ticket was refused. Check the subject and the message.",
  session_expired: "You are signed out. Log in again.",
  origin: "That request did not come from this site. Reload the page.",
  unavailable: "The Message Centre is unavailable right now. Try again shortly.",
  bad_request: "Something went wrong sending that. Try again.",
};

type State =
  | { kind: "editing" }
  | { kind: "submitting" }
  | { kind: "failed"; error: string }
  | { kind: "done" };

export default function NewTicketForm() {
  const [kind, setKind] = useState<TicketKind>("bug");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState<State>({ kind: "editing" });

  const left = BODY_MAX - body.length;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (state.kind === "submitting") return;

    setState({ kind: "submitting" });
    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, subject, body }),
      });

      if (response.ok) {
        setState({ kind: "done" });
        setSubject("");
        setBody("");
        return;
      }

      const payload: unknown = await response.json().catch(() => null);
      const code = (payload as { error?: string } | null)?.error ?? "unavailable";
      setState({
        kind: "failed",
        error: MESSAGES[code] ?? "The ticket could not be opened. Try again.",
      });
    } catch {
      setState({ kind: "failed", error: MESSAGES.unavailable });
    }
  }

  return (
    <>
      <TitleBox
        title="New ticket"
        links={[{ href: "/messages", text: "Message Centre" }]}
      />

      <Panel align="left">
        <div className={account.form}>
          {state.kind === "done" ? (
            <>
              <p className={account.success}>
                <b>Ticket opened.</b>
              </p>
              <p className={account.note}>
                A reply arrives in your Message Centre, and the game&apos;s
                welcome screen will show an unread message when it does.
              </p>
              <p className={account.success}>
                <a className={frame.link} href="/messages">
                  Back to the Message Centre
                </a>
              </p>
            </>
          ) : (
            <form onSubmit={onSubmit}>
              <div className={account.fields}>
                <label htmlFor="ticket-kind">About:</label>
                <select
                  id="ticket-kind"
                  className={styles.select}
                  value={kind}
                  onChange={(event) =>
                    setKind(event.target.value as TicketKind)
                  }
                >
                  {TICKET_KINDS.map((option) => (
                    <option key={option} value={option}>
                      {ticketKindLabel(option)}
                    </option>
                  ))}
                </select>

                <label htmlFor="ticket-subject">Subject:</label>
                <input
                  id="ticket-subject"
                  type="text"
                  value={subject}
                  maxLength={SUBJECT_MAX}
                  required
                  onChange={(event) => setSubject(event.target.value)}
                />
              </div>

              <p className={account.note}>Message:</p>
              <textarea
                className={styles.textarea}
                value={body}
                maxLength={BODY_MAX}
                required
                aria-label="Your message"
                onChange={(event) => setBody(event.target.value)}
              />
              <div
                className={`${styles.counter} ${left < 0 ? styles.counterOver : ""}`}
              >
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
                  disabled={
                    state.kind === "submitting" ||
                    subject.trim().length === 0 ||
                    body.trim().length === 0
                  }
                >
                  {state.kind === "submitting" ? "Opening..." : "Open ticket"}
                </button>
              </div>

              <div className={styles.hint}>
                <b>What makes a report we can act on:</b>
                <ul>
                  <li>which world you were on;</li>
                  <li>roughly when it happened;</li>
                  <li>what you were doing;</li>
                  <li>what happened instead.</li>
                </ul>
              </div>

              <p className={account.note}>
                You can open {TICKETS_PER_DAY} tickets a day. Staff read them by
                hand, so use one ticket per problem and reply on it rather than
                opening another.
              </p>
            </form>
          )}
        </div>
      </Panel>
    </>
  );
}
