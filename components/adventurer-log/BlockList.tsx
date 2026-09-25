"use client";

import { useState } from "react";

import { send } from "@/lib/adventurer-log/client";
import { INVALID_NAME, toDisplayName, toSafeName } from "@/lib/base37";

import styles from "./Settings.module.css";

type Blocked = { username: string; name: string };

/**
 * The players the owner has blocked from replying, each with a way back, and
 * a box to block someone by name without waiting for them to reply. A block
 * also stops that player's replies showing on the log.
 */
export default function BlockList({ initial }: { initial: Blocked[] }) {
  const [blocked, setBlocked] = useState(initial);
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function unblock(entry: Blocked) {
    setBusy(true);
    const result = await send("/api/adventurer-log/blocks", { target: entry.username }, "DELETE");
    setBusy(false);
    if (!result.ok) return setStatus(result.message);
    setBlocked((list) => list.filter((other) => other.username !== entry.username));
    setStatus(`${entry.name} can reply on your log again.`);
  }

  async function block(event: React.FormEvent) {
    event.preventDefault();
    const username = toSafeName(target);
    if (username === INVALID_NAME) return setStatus("There is no player by that name.");
    const name = toDisplayName(username);
    if (blocked.some((entry) => entry.username === username)) {
      return setStatus(`${name} is already blocked.`);
    }

    setBusy(true);
    const result = await send("/api/adventurer-log/blocks", { target: username });
    setBusy(false);
    if (!result.ok) return setStatus(result.message);
    setBlocked((list) => [...list, { username, name }].sort((a, b) => a.name.localeCompare(b.name)));
    setTarget("");
    setStatus(`${name} can no longer reply on your log.`);
  }

  return (
    <div className={styles.form}>
      {blocked.length === 0 ? (
        <p className={styles.hint}>Nobody. Block someone here, or with the Block button under their reply.</p>
      ) : (
        <ul className={styles.people}>
          {blocked.map((entry) => (
            <li key={entry.username}>
              <span>{entry.name}</span>
              <button type="button" disabled={busy} onClick={() => unblock(entry)}>
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={block} className={styles.blockForm}>
        <label htmlFor="block-name">Block a player</label>
        <input
          id="block-name"
          type="text"
          value={target}
          maxLength={12}
          autoComplete="off"
          onChange={(event) => setTarget(event.target.value)}
        />
        <button type="submit" disabled={busy || target.trim() === ""}>
          Block
        </button>
      </form>
      <p role="status">{status}</p>
    </div>
  );
}
