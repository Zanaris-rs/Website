"use client";

import { useState } from "react";

import type { BodyToken } from "@/lib/adventurer-log/body";
import { send } from "@/lib/adventurer-log/client";
import { formatWhen } from "@/lib/adventurer-log/format";
import { logHref } from "@/lib/adventurer-log/href";
import { INVALID_NAME, toDisplayName, toSafeName } from "@/lib/base37";

import Body from "./Body";
import styles from "./Settings.module.css";

type Blocked = { username: string; name: string };

/** A reply on the owner's log, as log management lists it. */
export type ManagedReply = {
  id: number;
  author: string;
  authorName: string;
  at: string;
  tokens: BodyToken[];
  /** A few words of the update it answers. */
  onUpdate: string;
};

/**
 * Managing who talks on the log: the players the owner has blocked, each
 * with a way back, a box to block someone by name, and the latest replies on
 * the log with Delete and Block beside each - so a pile-on can be dealt with
 * from one place instead of update by update. A block also stops that
 * player's replies showing on the log; their replies stay listed here,
 * marked, so the owner can see what a block is hiding.
 */
export default function BlockList({
  owner,
  initial,
  replies: initialReplies,
}: {
  /** The log's owner: their own replies get Delete but no Block. */
  owner: string;
  initial: Blocked[];
  /** Null when they could not be read; the rest of the box still works. */
  replies: ManagedReply[] | null;
}) {
  const [blocked, setBlocked] = useState(initial);
  const [replies, setReplies] = useState(initialReplies);
  const [target, setTarget] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isBlocked = (username: string) => blocked.some((entry) => entry.username === username);

  async function unblock(username: string) {
    const name = toDisplayName(username);
    setBusy(true);
    const result = await send("/api/adventurer-log/blocks", { target: username }, "DELETE");
    setBusy(false);
    if (!result.ok) return setStatus(result.message);
    setBlocked((list) => list.filter((other) => other.username !== username));
    setStatus(`${name} can reply on your log again.`);
  }

  async function block(username: string) {
    const name = toDisplayName(username);
    if (isBlocked(username)) return setStatus(`${name} is already blocked.`);

    setBusy(true);
    const result = await send("/api/adventurer-log/blocks", { target: username });
    setBusy(false);
    if (!result.ok) return setStatus(result.message);
    setBlocked((list) => [...list, { username, name }].sort((a, b) => a.name.localeCompare(b.name)));
    setStatus(`${name} can no longer reply on your log.`);
    return true;
  }

  async function blockByName(event: React.FormEvent) {
    event.preventDefault();
    const username = toSafeName(target);
    if (username === INVALID_NAME) return setStatus("There is no player by that name.");
    if (await block(username)) setTarget("");
  }

  async function remove(reply: ManagedReply) {
    setBusy(true);
    const result = await send(`/api/adventurer-log/replies/${reply.id}`, undefined, "DELETE");
    setBusy(false);
    if (!result.ok) return setStatus(result.message);
    setReplies((list) => list?.filter((other) => other.id !== reply.id) ?? null);
    setStatus(`${reply.authorName}'s reply is deleted.`);
  }

  return (
    <div className={styles.form}>
      {blocked.length === 0 ? (
        <p className={styles.hint}>Nobody. Block someone here, or from their reply below or on your log.</p>
      ) : (
        <ul className={styles.people}>
          {blocked.map((entry) => (
            <li key={entry.username}>
              <span>{entry.name}</span>
              <button type="button" disabled={busy} onClick={() => unblock(entry.username)}>
                Unblock
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={blockByName} className={styles.blockForm}>
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

      <h3 className={styles.subtitle}>Recent replies on your log</h3>
      {replies === null ? (
        <p className={styles.hint}>Your recent replies are unavailable right now.</p>
      ) : replies.length === 0 ? (
        <p className={styles.hint}>Nobody has replied to your updates yet.</p>
      ) : (
        <ul className={styles.replies}>
          {replies.map((reply) => {
            const hidden = isBlocked(reply.author);
            return (
              <li key={reply.id} className={hidden ? styles.hiddenReply : undefined}>
                <div>
                  <a href={logHref(reply.author)}>{reply.authorName}</a>{" "}
                  <time className={styles.count} dateTime={reply.at}>
                    {formatWhen(reply.at)}
                  </time>
                  {hidden ? <span className={styles.count}> (blocked: not shown on your log)</span> : null}
                </div>
                <p className={styles.replyBody}>
                  <Body tokens={reply.tokens} />
                </p>
                <div className={styles.row}>
                  <span className={styles.count}>on &ldquo;{reply.onUpdate}&rdquo;</span>
                  <button type="button" disabled={busy} onClick={() => remove(reply)}>
                    Delete
                  </button>
                  {reply.author === owner ? null : hidden ? (
                    <button type="button" disabled={busy} onClick={() => unblock(reply.author)}>
                      Unblock {reply.authorName}
                    </button>
                  ) : (
                    <button type="button" disabled={busy} onClick={() => block(reply.author)}>
                      Block {reply.authorName}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
