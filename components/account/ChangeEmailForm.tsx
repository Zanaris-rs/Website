"use client";

import { useState } from "react";

import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { PASSWORD_MAX_TYPED } from "@/lib/account/validation";

import styles from "./Account.module.css";

/**
 * Change the contact email.
 *
 * The current password is re-typed for the same reason it is on the password
 * form: this address is how staff would reach the owner, so a stolen cookie
 * must not be able to repoint it quietly.
 *
 * It is worth being blunt on the page about what the address is and is not.
 * There is no mailer, so it is never verified and never written to — it is a
 * note for staff, not a way to recover an account. A player who believes an
 * address here can reset a password will be disappointed at the worst moment.
 */

const MESSAGES: Record<string, string> = {
  bad_credentials: "That is not your current password.",
  rate_limited: "Too many attempts. Wait 15 minutes.",
  session_expired: "You are signed out. Log in again.",
  email_format: "That does not look like an email address.",
  email_disposable: "Disposable email addresses are not accepted.",
  email_no_mx: "That domain cannot receive email.",
  origin: "That request did not come from this site. Reload the page.",
  unavailable: "The account centre is unavailable right now. Try again shortly.",
  bad_request: "Something went wrong sending that. Try again.",
};

type State =
  | { kind: "editing" }
  | { kind: "submitting" }
  | { kind: "failed"; error: string }
  | { kind: "done"; email: string };

export default function ChangeEmailForm({ current }: { current: string }) {
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "editing" });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (state.kind === "submitting") return;

    setState({ kind: "submitting" });
    try {
      const response = await fetch("/api/account/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: password, email }),
      });

      const body: unknown = await response.json().catch(() => null);

      if (response.ok) {
        const saved = (body as { email?: string } | null)?.email ?? email;
        setState({ kind: "done", email: saved });
        setPassword("");
        setEmail("");
        return;
      }

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
        title="Change email"
        links={[{ href: "/account", text: "Account Centre" }]}
      />

      <Panel>
        <div className={styles.form}>
          {state.kind === "done" ? (
            <>
              <p className={styles.success}>
                <b>Email changed</b> to{" "}
                <span className={frame.highlight}>{state.email}</span>.
              </p>
              <p className={styles.success}>
                <a className={frame.link} href="/account">
                  Back to the Account Centre
                </a>
              </p>
            </>
          ) : (
            <>
              <p className={styles.note}>
                Current address: <span className={frame.highlight}>{current || "none"}</span>
              </p>

              <form onSubmit={onSubmit}>
                <div className={styles.fields}>
                  <label htmlFor="email-password">Current password:</label>
                  <input
                    id="email-password"
                    type="password"
                    value={password}
                    maxLength={PASSWORD_MAX_TYPED}
                    autoComplete="current-password"
                    required
                    onChange={(event) => setPassword(event.target.value)}
                  />

                  <label htmlFor="new-email">New email:</label>
                  <input
                    id="new-email"
                    type="email"
                    value={email}
                    autoComplete="email"
                    required
                    onChange={(event) => setEmail(event.target.value)}
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
                    {state.kind === "submitting" ? "Changing..." : "Change email"}
                  </button>
                </div>
              </form>

              <p className={styles.note}>
                This address is <b>never verified and never emailed</b>. It is
                only a contact address for staff — it cannot reset a password
                and it cannot recover an account.
              </p>
            </>
          )}
        </div>
      </Panel>
    </>
  );
}
