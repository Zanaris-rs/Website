"use client";

import { useState } from "react";

import { send } from "@/lib/adventurer-log/client";
import { REASON_MAX } from "@/lib/adventurer-log/format";

/**
 * "Report", opening a one-line reason and a Send. `target` is an update or a
 * reply by id, or a whole log by name. Staff read reports at
 * /staff/adventure-reports.
 */
export default function ReportButton({
  target,
  label = "Report",
}: {
  target: { kind: "update" | "reply"; id: number } | { kind: "log"; name: string };
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await send("/api/adventurer-log/reports", { ...target, reason });
    setBusy(false);
    if (result.ok) {
      setStatus("Reported. Thank you.");
      setOpen(false);
      setReason("");
    } else {
      setStatus(result.message);
    }
  }

  if (!open) {
    return (
      <span className="al-report">
        <button type="button" onClick={() => setOpen(true)}>
          {label}
        </button>
        {status ? <span role="status"> {status}</span> : null}
      </span>
    );
  }

  return (
    <form className="al-report" onSubmit={submit}>
      <input
        type="text"
        placeholder="What is wrong with it?"
        maxLength={REASON_MAX}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        autoFocus
      />{" "}
      <button type="submit" disabled={busy || reason.trim() === ""}>
        Send report
      </button>{" "}
      <button type="button" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {status ? <span role="status"> {status}</span> : null}
    </form>
  );
}
