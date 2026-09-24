"use client";

import { useState } from "react";

import { send } from "@/lib/adventurer-log/client";

/** The players the owner has blocked from replying, each with a way back. */
export default function BlockList({
  initial,
}: {
  initial: { username: string; name: string }[];
}) {
  const [blocked, setBlocked] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);

  async function unblock(username: string, name: string) {
    const result = await send("/api/adventurer-log/blocks", { target: username }, "DELETE");
    if (!result.ok) return setStatus(result.message);
    setBlocked((list) => list.filter((entry) => entry.username !== username));
    setStatus(`${name} can reply on your log again.`);
  }

  return (
    <div>
      <h2 style={{ margin: "0 0 6px", fontSize: 14 }}>Blocked players</h2>
      {blocked.length === 0 ? (
        <p style={{ margin: 0, color: "var(--text-muted)" }}>
          Nobody. Block someone from the Block button under their reply.
        </p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {blocked.map((entry) => (
            <li key={entry.username}>
              {entry.name}{" "}
              <button type="button" onClick={() => unblock(entry.username, entry.name)}>
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
      <span role="status">{status}</span>
    </div>
  );
}
