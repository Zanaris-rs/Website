import "server-only";

import type { Look } from "@/lib/chathead/look";
import { query } from "@/lib/db";
import { displayName } from "@/lib/hiscores/format";
import { chatheadLooks } from "@/lib/outfits/looks";

import { type BodyToken, parseBody } from "./body";
import { categorySlug } from "./categories";
import { type EventIcon, eventIcon } from "./events";
import {
  type Cursor,
  cursorOf,
  type Gz,
  parsePinned,
  parseReplies,
  parseTimeline,
  pinnedStatement,
  repliesStatement,
  TIMELINE_PAGE,
  type TimelineRow,
  timelineStatement,
} from "./queries";

/**
 * A page of a log's timeline, ready to draw: text already cut into tokens,
 * pictures already chosen, replies under their updates, and the look behind
 * every name that needs a chathead. Plain data, so the same shape serves the
 * page's first render and every "load more".
 */

export type ReplyView = {
  id: number;
  author: string;
  authorName: string;
  at: string;
  tokens: BodyToken[];
  canDelete: boolean;
};

export type EntryView =
  | {
      kind: "event";
      key: string;
      id: number;
      at: string;
      category: number;
      slug: string;
      text: string;
      icon: EventIcon;
      gz: Gz;
    }
  | {
      kind: "update";
      key: string;
      id: number;
      at: string;
      /** The text as the owner wrote it, codes and all: what Edit starts from. */
      body: string;
      tokens: BodyToken[];
      /** When the text last changed; null for never. */
      editedAt: string | null;
      replyCount: number;
      replies: ReplyView[];
    };

export type UpdateEntry = Extract<EntryView, { kind: "update" }>;

export type TimelinePage = {
  entries: EntryView[];
  next: Cursor | null;
  /** Chathead looks by username, for the reply authors on this page. */
  looks: Record<string, Look>;
};

/** The update pinned to the top of a log, and the looks its repliers need. */
export type PinnedView = {
  entry: UpdateEntry;
  looks: Record<string, Look>;
};

/**
 * A page of the timeline. `show` is a filter's mask (`filters.ts`), null
 * for everything; the database does the filtering, so every page of a
 * filtered view is full.
 */
export async function loadTimeline(
  name: string,
  viewer: string | null,
  before: Cursor | null,
  show: number | null,
): Promise<TimelinePage> {
  const statement = timelineStatement(name, viewer, before, show);
  const page = parseTimeline(
    await query<Record<string, unknown>>(statement.text, statement.values),
  );

  const { entries, looks } = await entriesOf(name, viewer, page.rows);
  const last = page.rows[page.rows.length - 1];
  return {
    entries,
    next: page.more && last ? cursorOf(last) : null,
    looks,
  };
}

/** The pinned update, or null for none (or one since deleted or hidden). */
export async function loadPinned(name: string, viewer: string | null): Promise<PinnedView | null> {
  const statement = pinnedStatement(name, viewer);
  const row = parsePinned(await query<Record<string, unknown>>(statement.text, statement.values));
  if (!row) return null;

  const { entries, looks } = await entriesOf(name, viewer, [row]);
  const [entry] = entries;
  return entry?.kind === "update" ? { entry, looks } : null;
}

/** Rows ready to draw: each update's replies read, and every replier's look. */
async function entriesOf(
  name: string,
  viewer: string | null,
  rows: readonly TimelineRow[],
): Promise<{ entries: EntryView[]; looks: Record<string, Look> }> {
  const updateIds = rows.filter((row) => row.kind === "update").map((row) => row.id);
  const replies =
    updateIds.length === 0
      ? []
      : await (async () => {
          const wanted = repliesStatement(name, viewer, updateIds);
          return parseReplies(
            await query<Record<string, unknown>>(wanted.text, wanted.values),
          );
        })();

  const authors = [...new Set(replies.map((reply) => reply.author))];
  const looks: Record<string, Look> = Object.fromEntries(await chatheadLooks(authors));

  const byUpdate = new Map<number, ReplyView[]>();
  for (const reply of replies) {
    const list = byUpdate.get(reply.updateId) ?? [];
    list.push({
      id: reply.id,
      author: reply.author,
      authorName: displayName(reply.author),
      at: reply.createdAt,
      tokens: parseBody(reply.body),
      canDelete: reply.canDelete,
    });
    byUpdate.set(reply.updateId, list);
  }

  const entries = rows.map((row): EntryView =>
    row.kind === "event"
      ? {
          kind: "event",
          key: `e${row.id}`,
          id: row.id,
          at: row.at,
          category: row.category,
          slug: categorySlug(row.category),
          text: row.body,
          icon: eventIcon(row.category, row.body),
          gz: row.gz,
        }
      : {
          kind: "update",
          key: `u${row.id}`,
          id: row.id,
          at: row.at,
          body: row.body,
          tokens: parseBody(row.body),
          editedAt: row.editedAt,
          replyCount: row.replyCount,
          replies: byUpdate.get(row.id) ?? [],
        },
  );

  return { entries, looks };
}

export { TIMELINE_PAGE };
