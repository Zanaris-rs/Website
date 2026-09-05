"use client";

import { useState } from "react";

import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { PASSWORD_MAX, PASSWORD_MIN, PASSWORD_MAX_TYPED } from "@/lib/account/validation";

import styles from "./Account.module.css";

/**
 * Change the password.
 *
 * No Turnstile here: the gate is the current password, which the database
 * compares and which the same rate limiter counts failures against. A widget
 * would only ask somebody who is already signed in to prove they are human
 * again.
 *
 * The page says out loud what the change does to other devices, because it is
 * the only revocation a stateless session has and it is surprising if it
 * happens silently: this browser stays signed in, everything else is bounced.
 */

const MESSAGES: Record<string, string> = {
  bad_credentials: "That is not your current password.",
  rate_limited: "Too many attempts. Wait 15 minutes.",
  session_expired: "You are signed out. Log in again.",
  password_short: `A password must be at least ${PASSWORD_MIN} characters.`,
  password_long: `A password can be at most ${PASSWORD_MAX} characters.`,
  password_charset:
    "A password can only use characters you can type on the login screen.",
  password_same: "That is the password you already have.",
  origin: "That request did not come from this site. Reload the page.",
  unavailable: "The account centre is unavailable right now. Try again shortly.",
  bad_request: "Something went wrong sending that. Try again.",
};

type State =
  | { kind: "editing" }
  | { kind: "submitting" }
  | { kind: "failed"; error: string }
  | { kind: "done" };

export default function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [state, setState] = useState<State>({ kind: "editing" });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (state.kind === "submitting") return;

    if (next !== repeat) {
      setState({ kind: "failed", error: "The new passwords do not match." });
      return;
    }

    setState({ kind: "submitting" });
    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });

      if (response.ok) {
        setState({ kind: "done" });
        setCurrent("");
        setNext("");
        setRepeat("");
        return;
      }

      const body: unknown = await response.json().catch(() => null);
      const code = (body as { error?: string } | null)?.error ?? "unavailable";
      setState({
        kind: "failed",
        error: MESSAGES[code] ?? "The change failed. Try again.",
      });
    } catch {
      setState({ kind: "failed", error: MESSAGES.unavailable });
    }
  }

  return (
    <>
      <TitleBox
        title="Change password"
        links={[{ href: "/account", text: "Account Centre" }]}
      />

      <Panel>
        <div className={styles.form}>
          {state.kind === "done" ? (
            <>
              <p className={styles.success}>
                <b>Password changed.</b>
              </p>
              <p className={styles.note}>
                Use the new password in the game as well — it is the same
                account. Every other browser you were signed in on has been
                signed out.
              </p>
              <p className={styles.success}>
                <a className={frame.link} href="/account">
                  Back to the Account Centre
                </a>
              </p>
            </>
          ) : (
            <>
              <form onSubmit={onSubmit}>
                <div className={styles.fields}>
                  <label htmlFor="current-password">Current password:</label>
                  <input
                    id="current-password"
                    type="password"
                    value={current}
                    maxLength={PASSWORD_MAX_TYPED}
                    autoComplete="current-password"
                    required
                    onChange={(event) => setCurrent(event.target.value)}
                  />

                  <label htmlFor="new-password">New password:</label>
                  <input
                    id="new-password"
                    type="password"
                    value={next}
                    minLength={PASSWORD_MIN}
                    maxLength={PASSWORD_MAX}
                    autoComplete="new-password"
                    required
                    onChange={(event) => setNext(event.target.value)}
                  />

                  <label htmlFor="repeat-password">Repeat new password:</label>
                  <input
                    id="repeat-password"
                    type="password"
                    value={repeat}
                    minLength={PASSWORD_MIN}
                    maxLength={PASSWORD_MAX}
                    autoComplete="new-password"
                    required
                    onChange={(event) => setRepeat(event.target.value)}
                  />
                </div>

                {state.kind === "failed" && (
                  <p className={styles.error} role="alert">
                    {state.error}
                  </p>
                )}

                <div className={styles.actions}>
                  <button
                    className={styles.submit}
                    type="submit"
                    disabled={state.kind === "submitting"}
                  >
                    {state.kind === "submitting"
                      ? "Changing..."
                      : "Change password"}
                  </button>
                </div>
              </form>

              <p className={styles.note}>
                {PASSWORD_MIN} to {PASSWORD_MAX} characters, and only ones the
                2004 login screen can type. Case is not kept, so{" "}
                <code>Hunter2</code> and <code>hunter2</code> are the same
                password.
              </p>
              <p className={styles.note}>
                Changing it signs out every other browser you are logged in on.
                This one stays signed in.
              </p>
            </>
          )}
        </div>
      </Panel>
    </>
  );
}
