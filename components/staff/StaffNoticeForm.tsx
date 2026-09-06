"use client";

import { useState } from "react";

import account from "@/components/account/Account.module.css";
import styles from "@/components/messages/Messages.module.css";
import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { PASSWORD_MAX_TYPED } from "@/lib/account/validation";
import {
  BODY_MAX,
  FIELD_MESSAGES,
  NOTICES_PER_HOUR,
  SUBJECT_MAX,
} from "@/lib/messages/format";
import { staffLinks } from "@/lib/staff/links";

/**
 * Send a notice into a player's Message Centre.
 *
 * This is the only form on the site that asks somebody who is *already signed
 * in* to type their password, and the reason is worth stating on the page as
 * well as in the code: this writes into another person's inbox with a
 * moderator's name on it. The password is compared by the database against the
 * moderator's own stored hash — the same compare-and-set the account centre
 * uses — so a stolen session, or a leaked database credential, is not enough
 * to impersonate a moderator here.
 *
 * The failures ride their own rate-limit bucket, not the moderator's login
 * bucket: ten fat-fingered notices must not also lock them out of signing in.
 */

const MESSAGES: Record<string, string> = {
  ...FIELD_MESSAGES,
  bad_credentials: "That is not your password.",
  not_found: "There is no account with that name.",
  forbidden: "Your account is not staff.",
  rate_limited: `Too many notices or too many wrong passwords. The cap is ${NOTICES_PER_HOUR} notices an hour.`,
  username_format:
    "A username is 1 to 12 letters, digits, spaces or underscores.",
  username_unencodable: "That is not a name the game can address.",
  session_expired: "You are signed out. Log in again.",
  origin: "That request did not come from this site. Reload the page.",
  unavailable: "The staff inbox is unavailable right now. Try again shortly.",
  bad_request: "Something went wrong sending that. Try again.",
};

type State =
  | { kind: "editing" }
  | { kind: "submitting" }
  | { kind: "failed"; error: string }
  | { kind: "done"; username: string };

export default function StaffNoticeForm() {
  const [username, setUsername] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<State>({ kind: "editing" });

  const left = BODY_MAX - body.length;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (state.kind === "submitting") return;

    setState({ kind: "submitting" });
    try {
      const response = await fetch("/api/staff/notice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, subject, body, password }),
      });

      if (response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const sent =
          (payload as { username?: string } | null)?.username ?? username;
        setState({ kind: "done", username: sent });
        setUsername("");
        setSubject("");
        setBody("");
        setPassword("");
        return;
      }

      const payload: unknown = await response.json().catch(() => null);
      const code = (payload as { error?: string } | null)?.error ?? "unavailable";
      setState({
        kind: "failed",
        error: MESSAGES[code] ?? "The notice could not be sent. Try again.",
      });
      // Whatever went wrong, the password box starts again: leaving a typed
      // password sitting in a form somebody walks away from is not worth the
      // convenience.
      setPassword("");
    } catch {
      setState({ kind: "failed", error: MESSAGES.unavailable });
      setPassword("");
    }
  }

  return (
    <>
      <TitleBox
        title="Send a notice"
        links={staffLinks("/staff/notice")}
      />

      <Panel align="left">
        <div className={account.form}>
          {state.kind === "done" ? (
            <>
              <p className={account.success}>
                <b>Notice sent to {state.username}.</b>
              </p>
              <p className={account.note}>
                It is unread in their Message Centre now, and the game&apos;s
                welcome screen will say so at their next login.
              </p>
              <p className={account.success}>
                <a
                  className={frame.link}
                  href="/staff/notice"
                  onClick={(event) => {
                    event.preventDefault();
                    setState({ kind: "editing" });
                  }}
                >
                  Send another
                </a>{" "}
                ·{" "}
                <a className={frame.link} href="/staff">
                  Staff inbox
                </a>
              </p>
            </>
          ) : (
            <form onSubmit={onSubmit}>
              <div className={account.fields}>
                <label htmlFor="notice-username">To:</label>
                <input
                  id="notice-username"
                  type="text"
                  value={username}
                  maxLength={12}
                  autoComplete="off"
                  required
                  onChange={(event) => setUsername(event.target.value)}
                />

                <label htmlFor="notice-subject">Subject:</label>
                <input
                  id="notice-subject"
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
                aria-label="The notice"
                onChange={(event) => setBody(event.target.value)}
              />
              <div
                className={`${styles.counter} ${left < 0 ? styles.counterOver : ""}`}
              >
                {left} characters left
              </div>

              <div className={account.fields}>
                <label htmlFor="notice-password">Your password:</label>
                <input
                  id="notice-password"
                  type="password"
                  value={password}
                  maxLength={PASSWORD_MAX_TYPED}
                  autoComplete="current-password"
                  required
                  onChange={(event) => setPassword(event.target.value)}
                />
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
                    username.trim().length === 0 ||
                    subject.trim().length === 0 ||
                    body.trim().length === 0 ||
                    password.length === 0
                  }
                >
                  {state.kind === "submitting" ? "Sending..." : "Send notice"}
                </button>
              </div>

              <p className={account.note}>
                This writes into someone else&apos;s Message Centre with your
                name on it, which is why it asks for your password again. The
                database compares it; the site never sees your stored hash.
              </p>
              <p className={account.note}>
                Up to {NOTICES_PER_HOUR} notices an hour, and every one is
                written to the audit log.
              </p>
            </form>
          )}
        </div>
      </Panel>
    </>
  );
}
