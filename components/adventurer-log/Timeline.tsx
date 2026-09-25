"use client";

import { useMemo, useState } from "react";

import type { BodyToken } from "@/lib/adventurer-log/body";
import { GZ_MESSAGES, send } from "@/lib/adventurer-log/client";
import { type Filter, filterOf, showsPosts, visibleFilters } from "@/lib/adventurer-log/filters";
import { checkText, REPLY_MAX, UPDATE_MAX } from "@/lib/adventurer-log/format";
import { type EventEntry, groupLevels } from "@/lib/adventurer-log/groups";
import { type Gz as GzState, GZ_TAKE_MAX, runGz, withGiven, withTaken } from "@/lib/adventurer-log/gz";
import type { Cursor } from "@/lib/adventurer-log/queries";
import type { EntryView, PinnedView, ReplyView, TimelinePage, UpdateEntry } from "@/lib/adventurer-log/view";
import type { Look } from "@/lib/chathead/look";

import Composer from "./Composer";
import Entry from "./Entry";
import Gz from "./Gz";
import LevelRunRow from "./LevelRun";
import ReportButton from "./ReportButton";

/** Who is reading, as the header's `is_owner` / `viewer_blocked` / `viewer_can_post` decided. */
export type TimelineViewer = {
  username: string;
  isOwner: boolean;
  /** The owner has blocked them: no replies, and no gz. */
  blocked: boolean;
  /** Signed in, not banned or muted, and not blocked by the owner. */
  canPost: boolean;
};

const UNPINNED = "Unpinned. It is back in its place in your log the next time the page loads.";

/**
 * The timeline, newest first, and everything a reader can do to it: the
 * owner posts, edits, pins and deletes updates, deletes any reply and blocks
 * repliers; anyone signed in who may post replies; anyone signed in reports;
 * anyone signed in but the owner and the players they blocked says "gz" to
 * adventures (a mute does not stop it; the server refuses a banned account).
 * The first page arrives with the page; "Older adventures" reads the rest
 * (`GET /api/adventurer-log/<name>/timeline`), in the same shape and under
 * the same filter. The filter buttons are links (`?show=`), so choosing one
 * loads the page again, filtered on the server. The pinned update comes
 * first wherever updates show, and never again in the list below it.
 */
export default function Timeline({
  username,
  ownerName,
  ownerLook,
  first,
  pinned: firstPinned,
  show,
  hiddenCategories,
  empty,
  viewer,
}: {
  username: string;
  ownerName: string;
  ownerLook: Look | null;
  first: TimelinePage;
  pinned: PinnedView | null;
  /** The filter the page was drawn with. */
  show: Filter["slug"];
  /** The owner's hidden kinds of adventure, which have no filter button. */
  hiddenCategories: number;
  empty: string;
  viewer: TimelineViewer | null;
}) {
  const [entries, setEntries] = useState<EntryView[]>(first.entries);
  const [pinned, setPinned] = useState<UpdateEntry | null>(firstPinned?.entry ?? null);
  const [looks, setLooks] = useState<Record<string, Look>>({ ...first.looks, ...firstPinned?.looks });
  const [next, setNext] = useState<Cursor | null>(first.next);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  const filter = filterOf(show);

  /** Change one update, wherever it is drawn: in the list, or pinned above it. */
  function changeUpdate(id: number, change: (update: UpdateEntry) => UpdateEntry) {
    setEntries((shown) => shown.map((entry) => (entry.kind === "update" && entry.id === id ? change(entry) : entry)));
    setPinned((top) => (top && top.id === id ? change(top) : top));
  }

  /** Change the gz of these adventures, wherever they are in the list. */
  function changeGz(ids: readonly number[], change: (gz: GzState, id: number) => GzState) {
    const wanted = new Set(ids);
    setEntries((shown) =>
      shown.map((entry) =>
        entry.kind === "event" && wanted.has(entry.id) ? { ...entry, gz: change(entry.gz, entry.id) } : entry,
      ),
    );
  }

  /**
   * Give a gz, or take yours back: shown at once, and put back as it was,
   * with the reason, if the server refuses. `events` is one adventure, or a
   * level run's, newest first: a run's gz goes on its newest level, and
   * taking it back takes it from every level in the run.
   */
  async function toggleGz(events: readonly EventEntry[]) {
    if (!viewer || events.length === 0) return;
    const me = viewer.username;
    const taking = runGz(events).mine;
    const ids = taking ? events.map((event) => event.id) : [events[0].id];
    const before = new Map(events.map((event) => [event.id, event.gz]));

    changeGz(ids, (gz) => (taking ? withTaken(gz, me) : withGiven(gz, me)));

    let refused: string | null = null;
    if (taking) {
      for (let i = 0; i < ids.length && refused === null; i += GZ_TAKE_MAX) {
        const result = await send("/api/adventurer-log/gz", { events: ids.slice(i, i + GZ_TAKE_MAX) }, "DELETE", GZ_MESSAGES);
        if (!result.ok) refused = result.message;
      }
    } else {
      const result = await send("/api/adventurer-log/gz", { event: ids[0] }, "POST", GZ_MESSAGES);
      if (!result.ok) refused = result.message;
    }

    if (refused !== null) {
      changeGz(ids, (gz, id) => before.get(id) ?? gz);
      setNotice(refused);
    }
  }

  async function more() {
    if (!next) return;
    setLoading(true);
    setFailed(false);
    try {
      const params = new URLSearchParams({
        at: next.at,
        rank: String(next.rank),
        id: String(next.id),
        show: filter.slug,
      });
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
    changeUpdate(updateId, (update) => ({
      ...update,
      replies: [...update.replies, reply],
      replyCount: update.replyCount + 1,
    }));
    return null;
  }

  /** Save an edit. An unchanged text is not sent: it would not be an edit. */
  async function saveEdit(update: UpdateEntry, text: string): Promise<string | null> {
    const checked = checkText(text, "Your update", UPDATE_MAX);
    if (!checked.ok) return checked.error;
    if (checked.value === update.body) {
      setEditing(null);
      return null;
    }
    const result = await send(`/api/adventurer-log/updates/${update.id}`, { body: checked.value }, "PATCH");
    if (!result.ok) return result.message;
    changeUpdate(update.id, (shown) => ({
      ...shown,
      body: checked.value,
      tokens: result.data.tokens as BodyToken[],
      editedAt: result.data.editedAt as string,
    }));
    setEditing(null);
    return null;
  }

  /** Pin to the top, in place of any other: that one is gone until a reload. */
  async function pin(update: UpdateEntry) {
    const result = await send("/api/adventurer-log/pin", { id: update.id }, "PUT");
    if (!result.ok) return setNotice(result.message);
    setEntries((shown) => shown.filter((entry) => !(entry.kind === "update" && entry.id === update.id)));
    setNotice(pinned ? UNPINNED : null);
    setPinned(update);
  }

  async function unpin() {
    const result = await send("/api/adventurer-log/pin", { id: null }, "PUT");
    if (!result.ok) return setNotice(result.message);
    setPinned(null);
    setNotice(UNPINNED);
  }

  async function deleteUpdate(id: number) {
    if (!window.confirm("Delete this update and its replies from your log?")) return;
    const result = await send(`/api/adventurer-log/updates/${id}`, undefined, "DELETE");
    if (!result.ok) return setNotice(result.message);
    setEntries((shown) => shown.filter((entry) => !(entry.kind === "update" && entry.id === id)));
    setPinned((top) => (top?.id === id ? null : top));
  }

  async function deleteReply(updateId: number, id: number) {
    if (!window.confirm("Delete this reply?")) return;
    const result = await send(`/api/adventurer-log/replies/${id}`, undefined, "DELETE");
    if (!result.ok) return setNotice(result.message);
    changeUpdate(updateId, (update) => ({
      ...update,
      replies: update.replies.filter((reply) => reply.id !== id),
      replyCount: update.replyCount - 1,
    }));
  }

  async function block(author: string, authorName: string) {
    if (!window.confirm(`Block ${authorName}? They will not be able to reply on your log, and their replies here will be hidden.`)) {
      return;
    }
    const result = await send("/api/adventurer-log/blocks", { target: author });
    if (!result.ok) return setNotice(result.message);
    setNotice(`${authorName} is blocked. You can let them back from your log's settings.`);
    const hide = (update: UpdateEntry) => ({
      ...update,
      replies: update.replies.filter((reply) => reply.author !== author),
    });
    setEntries((shown) => shown.map((entry) => (entry.kind === "update" ? hide(entry) : entry)));
    setPinned((top) => (top ? hide(top) : top));
  }

  const isOwner = viewer?.isOwner ?? false;
  const canGz = viewer !== null && !viewer.isOwner && !viewer.blocked;
  // Grouped over the whole loaded list, so "Older adventures" continues a run
  // rather than starting a new one where the page boundary happens to fall.
  const items = useMemo(() => groupLevels(entries), [entries]);
  const top = showsPosts(filter) ? pinned : null;

  function renderEntry(item: EntryView, isPinned: boolean) {
    return (
      <Entry
        key={isPinned ? `pinned-${item.key}` : item.key}
        entry={item}
        ownerName={ownerName}
        ownerLook={ownerLook}
        looks={looks}
        pinned={isPinned}
        gz={(event) => <Gz gz={event.gz} onToggle={canGz ? () => toggleGz([event]) : undefined} />}
        updateActions={
          viewer
            ? (update) =>
                isOwner ? (
                  <>
                    {viewer.canPost ? (
                      <button type="button" onClick={() => setEditing(update.id)}>
                        Edit
                      </button>
                    ) : null}
                    {isPinned ? (
                      <button type="button" onClick={unpin}>
                        Unpin
                      </button>
                    ) : (
                      <button type="button" onClick={() => pin(update)}>
                        Pin
                      </button>
                    )}
                    <button type="button" onClick={() => deleteUpdate(update.id)}>
                      Delete
                    </button>
                  </>
                ) : (
                  <ReportButton target={{ kind: "update", id: update.id }} />
                )
            : undefined
        }
        editor={
          isOwner
            ? (update) =>
                editing === update.id ? (
                  <Composer
                    max={UPDATE_MAX}
                    rows={3}
                    placeholder="What have you been up to?"
                    submitLabel="Save"
                    initial={update.body}
                    onSubmit={(text) => saveEdit(update, text)}
                    onCancel={() => setEditing(null)}
                  />
                ) : null
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
    );
  }

  return (
    <>
      <nav className="al-filters" aria-label="Show">
        {visibleFilters(hiddenCategories).map((choice) => (
          <a
            key={choice.slug}
            className="al-filter"
            href={`?show=${choice.slug}`}
            aria-current={choice.slug === filter.slug ? "page" : undefined}
          >
            {choice.label}
          </a>
        ))}
      </nav>
      {isOwner && viewer?.canPost && showsPosts(filter) ? (
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

      {entries.length === 0 && !top ? (
        <p className="al-empty">{filter.slug === "all" ? empty : "Nothing here yet."}</p>
      ) : (
        <ul className="al-entries">
          {top ? renderEntry(top, true) : null}
          {items.map((item) =>
            item.kind === "levels" ? (
              <LevelRunRow
                key={item.key}
                run={item}
                ownerName={ownerName}
                ownerLook={ownerLook}
                looks={looks}
                onGz={canGz ? () => toggleGz(item.events) : undefined}
              />
            ) : (
              renderEntry(item, false)
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
