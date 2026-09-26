"use client";

import { useState } from "react";

import { formatWhen } from "@/lib/adventurer-log/format";
import { logHref } from "@/lib/adventurer-log/href";
import type { AdventureReport, StaffAction } from "@/lib/adventurer-log/staff";


const LABELS: Record<StaffAction, string> = {
  hide: "Hide it",
  disable_css: "Turn off the log's stylesheet",
  dismiss: "Dismiss",
};

const MESSAGES: Record<string, string> = {
  bad_credentials: "That password is not right.",
  rate_limited: "Too many wrong passwords. Wait a few minutes.",
  forbidden: "You are not staff.",
  not_found: "That report is gone.",
  invalid: "That action does not apply to this report.",
  session_expired: "You have been signed out.",
  unavailable: "Unavailable right now. Try again.",
};

function Resolve({ report, onDone }: { report: AdventureReport; onDone: () => void }) {
  const actions: StaffAction[] =
    report.targetKind === "log" ? ["hide", "disable_css", "dismiss"] : ["hide", "dismiss"];
  const [action, setAction] = useState<StaffAction>(actions[0]);
  const [note, setNote] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/staff/adventure-reports/${report.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note, password }),
        credentials: "same-origin",
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (response.ok) {
        onDone();
        return;
      }
      setStatus(MESSAGES[body.error ?? ""] ?? MESSAGES.unavailable);
    } catch {
      setStatus(MESSAGES.unavailable);
    } finally {
      setBusy(false);
      setPassword("");
    }
  }

  return (
    <form onSubmit={submit}>
      {actions.map((choice) => (
        <label key={choice} style={{ marginRight: 12 }}>
          <input type="radio" name={`action-${report.id}`} checked={action === choice} onChange={() => setAction(choice)} />{" "}
          {LABELS[choice]}
        </label>
      ))}
      <div>
        <input type="text" placeholder="Note (optional)" value={note} onChange={(event) => setNote(event.target.value)} />{" "}
        <input
          type="password"
          placeholder="Your password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />{" "}
        <button type="submit" disabled={busy || password === ""}>
          Resolve
        </button>{" "}
        <span role="status">{status}</span>
      </div>
    </form>
  );
}

/**
 * Adventurer Log reports, open ones first. What was reported is shown as it
 * stands now - `content_state` says whether it is still up - so a moderator
 * reads the thing itself, not a copy made when it was reported.
 */
export default function AdventureReports({ reports }: { reports: AdventureReport[] }) {

  if (reports.length === 0) return <p>No reports.</p>;

  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, textAlign: "left" }}>
      {reports.map((report) => (
        <li key={report.id} style={{ borderBottom: "1px solid var(--rule)", padding: "8px 0" }}>
          <div>
            <b>#{report.id}</b> {report.targetKind}
            {report.logOwner ? (
              <>
                {" "}
                on <a href={logHref(report.logOwner)}>{report.logOwner}</a>&rsquo;s log
              </>
            ) : null}
            {report.author && report.author !== report.logOwner ? <> by {report.author}</> : null} &middot; reported by{" "}
            {report.reporter}, {formatWhen(report.createdAt)} &middot; <i>{report.contentState}</i>
          </div>
          <div>
            Reason: <q>{report.reason}</q>
          </div>
          {report.content ? (
            <pre style={{ whiteSpace: "pre-wrap", margin: "4px 0", fontFamily: "inherit" }}>{report.content}</pre>
          ) : null}
          {report.css ? (
            <details>
              <summary>Stylesheet ({report.css.length} characters)</summary>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 11 }}>{report.css}</pre>
            </details>
          ) : null}
          {report.resolvedAt ? (
            <div>
              Resolved: {report.resolution} by {report.resolvedBy}, {formatWhen(report.resolvedAt)}
              {report.note ? <> &mdash; {report.note}</> : null}
            </div>
          ) : (
            <Resolve report={report} onDone={() => window.location.reload()} />
          )}
        </li>
      ))}
    </ul>
  );
}
