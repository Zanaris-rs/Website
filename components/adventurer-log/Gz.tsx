"use client";

import { useState } from "react";

import { type Gz as GzState, gzWho } from "@/lib/adventurer-log/gz";

/**
 * An adventure's "gz", drawn inside its text cell (never as a fourth child
 * of the `.al-event` grid): the button for a reader who may give one, then
 * how many gave it. The count's title names them; clicking it shows the
 * names too, for a touch screen with no hover. `onToggle` is there only for
 * a signed-in reader who is not the owner and not blocked by them; everyone
 * else sees the count, and nothing at all when there is none.
 */
export default function Gz({ gz, onToggle }: { gz: GzState; onToggle?: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  if (!onToggle && gz.count === 0) return null;
  const who = gzWho(gz);

  async function toggle() {
    if (!onToggle) return;
    setBusy(true);
    try {
      await onToggle();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="al-gz">
      {" "}
      {onToggle ? (
        <button type="button" className="al-gz-button" aria-pressed={gz.mine} disabled={busy} onClick={toggle}>
          {gz.mine ? "gz'd" : "gz"}
        </button>
      ) : null}
      {gz.count > 0 ? (
        <>
          {onToggle ? " " : null}
          <button
            type="button"
            className="al-gz-count"
            title={who}
            aria-expanded={open}
            onClick={() => setOpen((shown) => !shown)}
          >
            {gz.count} gz
          </button>
          {open ? <span className="al-gz-names">{who}</span> : null}
        </>
      ) : null}
    </span>
  );
}
