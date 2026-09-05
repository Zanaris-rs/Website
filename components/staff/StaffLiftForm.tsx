"use client";

import { useState } from "react";

import account from "@/components/account/Account.module.css";
import { PASSWORD_MAX_TYPED } from "@/lib/account/validation";
import { PUBLIC_NOTE_MAX } from "@/lib/staff/format";

/**
 * Lift a ban or a mute.
 *
 * One button, one note, one password. The note is **public** — it appears on
 * `/bans` beside the punishment it explains — so the form says so where the
 * note is typed rather than after it has been written.
 *
 * The punishment row is not deleted and cannot be: a permanent record that
 * loses the entries somebody changed their mind about is not a record. The row
 * stays, saying it was lifted and when.
 */

const MESSAGES: Record<string, string> = {
  bad_credentials: "That is not your password.",
  forbidden: "Your account is not staff.",
  not_found: "That punishment is gone, or has already been lifted.",
  invalid: "That note is not something the record can hold.",
  note_long: `A public note can be at most ${PUBLIC_NOTE_MAX} characters.`,
  rate_limited: "Too many wrong passwords. Wait, then try again.",
  session_expired: "You are signed out. Log in again.",
  origin: "That request did not come from this site. Reload the page.",
  unavailable: "The staff tools are unavailable right now. Try again shortly.",
  bad_request: "Something went wrong sending that. Try again.",
};

type State =
  | { kind: "editing" }
  | { kind: "submitting" }
  | { kind: "failed"; error: string }
  | { kind: "done" };

export default function StaffLiftForm({
  punishmentId,
  kind,
  username,
}: {
  punishmentId: number;
  /** "ban" or "mute", for the sentence on the button. */
  kind: string;
  username: string;
}) {
  const [note, setNote] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<State>({ kind: "editing" });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (state.kind === "submitting") return;

    setState({ kind: "submitting" });
    try {
      const response = await fetch(
        `/api/staff/punishments/${punishmentId}/lift`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note, password }),
        },
      );

      if (response.ok) {
        setState({ kind: "done" });
        setPassword("");
        return;
      }

      const payload: unknown = await response.json().catch(() => null);
      const code =
        (payload as { error?: string } | null)?.error ?? "unavailable";
      setState({
        kind: "failed",
        error: MESSAGES[code] ?? "That could not be lifted. Try again.",
      });
      setPassword("");
    } catch {
      setState({ kind: "failed", error: MESSAGES.unavailable });
      setPassword("");
    }
  }

  if (state.kind === "done") {
    return (
      <p className={account.success}>
        <b>
          The {kind} on {username} has been lifted.
        </b>{" "}
        The public record keeps the entry and now says when it was lifted.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className={account.form}>
      <div className={account.fields}>
        <label htmlFor="lift-note">Public note:</label>
        <input
          id="lift-note"
          type="text"
          value={note}
          maxLength={PUBLIC_NOTE_MAX}
          autoComplete="off"
          placeholder="optional, shown on /bans"
          onChange={(event) => setNote(event.target.value)}
        />

        <label htmlFor="lift-password">Your password:</label>
        <input
          id="lift-password"
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
          disabled={state.kind === "submitting" || password.length === 0}
        >
          {state.kind === "submitting" ? "Lifting..." : `Lift the ${kind}`}
        </button>
      </div>

      <p className={account.note}>
        This clears the account&apos;s {kind} and stamps the public record as
        lifted, in one statement — the two used to be separate, which is how a
        player could be un-banned in the database and still banned on the page.
        The note is public.
      </p>
    </form>
  );
}
