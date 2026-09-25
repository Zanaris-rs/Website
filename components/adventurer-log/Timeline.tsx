"use client";

import { useMemo, useState } from "react";

import { send } from "@/lib/adventurer-log/client";
import { REPLY_MAX, UPDATE_MAX } from "@/lib/adventurer-log/format";
import { groupLevels } from "@/lib/adventurer-log/groups";
import type { Cursor } from "@/lib/adventurer-log/queries";
import type { EntryView, ReplyView, TimelinePage } from "@/lib/adventurer-log/view";
import type { Look } from "@/lib/chathead/look";

import Composer from "./Composer";
import Entry from "./Entry";
import LevelRunRow from "./LevelRun";
import ReportButton from "./ReportButton";

/** Who is reading, as the header's `is_owner` / `viewer_can_post` decided. */
export type TimelineViewer = {
  username: string;
  isOwner: boolean;
  /** Signed in, not banned or muted, and not blocked by the owner. */
  canPost: boolean;
};

/**
 * The timeline, newest first, and everything a reader can do to it: the
 * owner posts and deletes updates, deletes any reply and blocks repliers;
 * anyone signed in who may post replies; anyone signed in reports. The first
 * page arrives with the page; "Older adventures" reads the rest
 * (`GET /api/adventurer-log/<name>/timeline`), in the same shape.
 */
export default function Timeline({
  username,
  ownerName,
  ownerLook,
  first,
  empty,
  viewer,
}: {
  username: string;
  ownerName: string;
  ownerLook: Look | null;
  first: TimelinePage;
  empty: string;
  viewer: TimelineViewer | null;
}) {
  const [entries, setEntries] = useState<EntryView[]>(first.entries);
  const [looks, setLooks] = useState<Record<string, Look>>(first.looks);
  const [next, setNext] = useState<Cursor | null>(first.next);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function more() {
    if (!next) return;
    setLoading(true);
    setFailed(false);
    try {
      const params = new URLSearchParams({ at: next.at, rank: String(next.rank), id: String(next.id) });
      const response = await fetch(
        `/api/adventurer-log/${encodeURIComponent(username)}/timeline?${params}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(String(response.status));
      const page = (await response.json()) as TimelinePage;
      setEntries((shown) => {
        const seen = new Set(shown.map((entry) => entry.key));
        return [...shown, ...page.entries.filter((entry) => !seen.has(entry.key))];
      });
      setLooks((known) => ({ ...known, ...page.looks }));
      setNext(page.next);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  async function postUpdate(text: string): Promise<string | null> {
    const result = await send("/api/adventurer-log/updates", { body: text });
    if (!result.ok) return result.message;
    setEntries((shown) => [result.data.entry as EntryView, ...shown]);
    return null;
  }

  async function postReply(updateId: number, text: string): Promise<string | null> {
    const result = await send(`/api/adventurer-log/updates/${updateId}/replies`, { body: text });
    if (!result.ok) return result.message;
    const reply = result.data.reply as ReplyView;
    const look = result.data.look as Look | null;
    if (look) setLooks((known) => ({ ...known, [reply.author]: look }));
    setEntries((shown) =>
      shown.map((entry) =>
        entry.kind === "update" && entry.id === updateId
          ? { ...entry, replies: [...entry.replies, reply], replyCount: entry.replyCount + 1 }
          : entry,
      ),
    );
    return null;
  }

  async function deleteUpdate(id: number) {
    if (!window.confirm("Delete this update and its replies from your log?")) return;
    const result = await send(`/api/adventurer-log/updates/${id}`, undefined, "DELETE");
    if (!result.ok) return setNotice(result.message);
    setEntries((shown) => shown.filter((entry) => !(entry.kind === "update" && entry.id === id)));
  }

  async function deleteReply(updateId: number, id: number) {
    if (!window.confirm("Delete this reply?")) return;
    const result = await send(`/api/adventurer-log/replies/${id}`, undefined, "DELETE");
    if (!result.ok) return setNotice(result.message);
    setEntries((shown) =>
      shown.map((entry) =>
        entry.kind === "update" && entry.id === updateId
          ? { ...entry, replies: entry.replies.filter((reply) => reply.id !== id), replyCount: entry.replyCount - 1 }
          : entry,
      ),
    );
  }

  async function block(author: string, authorName: string) {
    if (!window.confirm(`Block ${authorName}? They will not be able to reply on your log, and their replies here will be hidden.`)) {
      return;
    }
    const result = await send("/api/adventurer-log/blocks", { target: author });
    if (!result.ok) return setNotice(result.message);
    setNotice(`${authorName} is blocked. You can let them back from your log's settings.`);
    setEntries((shown) =>
      shown.map((entry) =>
        entry.kind === "update"
          ? { ...entry, replies: entry.replies.filter((reply) => reply.author !== author) }
          : entry,
      ),
    );
  }

  const isOwner = viewer?.isOwner ?? false;
  // Grouped over the whole loaded list, so "Older adventures" continues a run
  // rather than starting a new one where the page boundary happens to fall.
  const items = useMemo(() => groupLevels(entries), [entries]);

  return (
    <>
      {isOwner && viewer?.canPost ? (
        <div className="al-post">
          <Composer
            max={UPDATE_MAX}
            rows={3}
            placeholder="What have you been up to?"
            submitLabel="Post update"
            onSubmit={postUpdate}
          />
        </div>
      ) : null}
      {notice ? (
        <p className="al-notice" role="status">
          {notice}
        </p>
      ) : null}

      {entries.length === 0 ? (
        <p className="al-empty">{empty}</p>
      ) : (
        <ul className="al-entries">
          {items.map((item) =>
            item.kind === "levels" ? (
              <LevelRunRow key={item.key} run={item} ownerName={ownerName} ownerLook={ownerLook} looks={looks} />
            ) : (
              <Entry
                key={item.key}
                entry={item}
                ownerName={ownerName}
                ownerLook={ownerLook}
                looks={looks}
                updateActions={
                  viewer
                    ? (update) =>
                        isOwner ? (
                          <button type="button" onClick={() => deleteUpdate(update.id)}>
                            Delete
                          </button>
                        ) : (
                          <ReportButton target={{ kind: "update", id: update.id }} />
                        )
                    : undefined
                }
                replyActions={
                  viewer
                    ? (reply, updateId) => (
                        <>
                          {reply.canDelete ? (
                            <button type="button" onClick={() => deleteReply(updateId, reply.id)}>
                              Delete
                            </button>
                          ) : null}
                          {isOwner && reply.author !== viewer.username ? (
                            <button type="button" onClick={() => block(reply.author, reply.authorName)}>
                              Block
                            </button>
                          ) : null}
                          {reply.author !== viewer.username ? (
                            <ReportButton target={{ kind: "reply", id: reply.id }} />
                          ) : null}
                        </>
                      )
                    : undefined
                }
                replyForm={
                  viewer?.canPost
                    ? (update) => (
                        <Composer
                          max={REPLY_MAX}
                          rows={2}
                          placeholder="Write a reply"
                          submitLabel="Reply"
                          onSubmit={(text) => postReply(update.id, text)}
                        />
                      )
                    : undefined
                }
              />
            ),
          )}
        </ul>
      )}
      {next ? (
        <p className="al-more">
          <button type="button" onClick={more} disabled={loading}>
            {loading ? "Loading…" : "Older adventures"}
          </button>
          {failed ? <span role="status"> That did not load. Try again.</span> : null}
        </p>
      ) : null}
    </>
  );
}
