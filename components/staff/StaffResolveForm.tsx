"use client";

import { useState } from "react";

import account from "@/components/account/Account.module.css";
import messages from "@/components/messages/Messages.module.css";
import { PASSWORD_MAX_TYPED } from "@/lib/account/validation";
import { FIELD_MESSAGES } from "@/lib/messages/format";
import { STAFF_NOTE_MAX, resolutionLabel } from "@/lib/staff/format";
import { RESOLUTIONS, type Resolution } from "@/lib/staff/queries";

import styles from "./Staff.module.css";

/**
 * Close a report: actioned, dismissed, or watch.
 *
 * It asks for a password because one of the three is destructive. **Dismissed
 * deletes the evidence** — the input chunks and the copied chat for this
 * report's uuid, immediately and permanently — which is the owner's decision
 * and the right one: a report staff have thrown out should not leave a record
 * of somebody's mouse on a server for another month. The page says so above
 * the button, not in a tooltip.
 *
 * The other two write a resolution and a note. Neither bans anybody: the ban
 * is `::ban` in game, and this is the note saying it happened.
 */

const MESSAGES: Record<string, string> = {
  ...FIELD_MESSAGES,
  bad_credentials: "That is not your password.",
  forbidden: "Your account is not staff.",
  not_found: "That report is gone.",
  invalid: "That is not one of the three resolutions.",
  rate_limited: "Too many wrong passwords. Wait, then try again.",
  session_expired: "You are signed out. Log in again.",
  origin: "That request did not come from this site. Reload the page.",
  unavailable: "The staff tools are unavailable right now. Try again shortly.",
  bad_request: "Something went wrong sending that. Try again.",
};

const EXPLAIN: Record<Resolution, string> = {
  actioned: "The report was right and something was done about it.",
  dismissed:
    "The report was wrong or unfounded. This deletes the input capture and the copied chat, now and permanently.",
  watch: "Not proven either way. Keep the evidence and look again later.",
};

/**
 * The thing a moderator has to know before they pick "dismissed", and the one
 * they have no way of working out from this page.
 *
 * The world captures a player **once per fifteen minutes**, and every report
 * filed against them inside that window points at the same capture. Six people
 * reporting one macroer produce six report rows and one copy of the evidence.
 * So dismissing any one of them deletes the evidence behind all six — and the
 * duplicate, the one that looks safest to clear out first, is exactly the one
 * that takes the real report's evidence with it.
 */
const DISMISS_WARNING =
  "One capture covers every report filed against this player inside the same fifteen minutes, so dismissing this one deletes the evidence for all of them — including the report you meant to keep. Dismiss the duplicates last, or resolve them as watched.";

type State =
  | { kind: "editing" }
  | { kind: "submitting" }
  | { kind: "failed"; error: string }
  | { kind: "done"; resolution: Resolution };

export default function StaffResolveForm({ reportId }: { reportId: number }) {
  const [resolution, setResolution] = useState<Resolution>("watch");
  const [note, setNote] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<State>({ kind: "editing" });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (state.kind === "submitting") return;

    setState({ kind: "submitting" });
    try {
      const response = await fetch(
        `/api/staff/reports/${reportId}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resolution, note, password }),
        },
      );

      if (response.ok) {
        setState({ kind: "done", resolution });
        setPassword("");
        return;
      }

      const payload: unknown = await response.json().catch(() => null);
      const code =
        (payload as { error?: string } | null)?.error ?? "unavailable";
      setState({
        kind: "failed",
        error: MESSAGES[code] ?? "That could not be saved. Try again.",
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
        <b>Resolved as {resolutionLabel(state.resolution).toLowerCase()}.</b>{" "}
        {state.resolution === "dismissed"
          ? "The input capture and the copied chat have been deleted, for this report and for every other report that shared the capture."
          : "The evidence stays until it is thirty days old."}{" "}
        <a className={account.note} href="/staff/reports">
          Back to the reports list
        </a>
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className={account.form}>
      {RESOLUTIONS.map((option) => (
        <div key={option} className={styles.choice}>
          <label>
            <input
              type="radio"
              name="resolution"
              value={option}
              checked={resolution === option}
              onChange={() => setResolution(option)}
            />{" "}
            <b>{resolutionLabel(option)}</b> — {EXPLAIN[option]}
          </label>
          {option === "dismissed" ? (
            <div
              className={
                resolution === "dismissed" ? styles.warning : styles.detail
              }
            >
              {DISMISS_WARNING}
            </div>
          ) : null}
        </div>
      ))}

      <p className={account.note}>Note (optional, staff only):</p>
      <textarea
        className={messages.textarea}
        value={note}
        maxLength={STAFF_NOTE_MAX}
        aria-label="A note on this report, for staff"
        onChange={(event) => setNote(event.target.value)}
      />

      <div className={account.fields}>
        <label htmlFor="resolve-password">Your password:</label>
        <input
          id="resolve-password"
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
          {state.kind === "submitting" ? "Saving..." : "Resolve report"}
        </button>
      </div>

      <p className={account.note}>
        The database compares the password against your own stored hash, the
        same way the notice form does; the site never sees your stored hash.
        Every resolution is written to the audit log with your name on it.
      </p>
    </form>
  );
}
