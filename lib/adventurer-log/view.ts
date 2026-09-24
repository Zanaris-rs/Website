import "server-only";

import type { Look } from "@/lib/chathead/look";
import { query } from "@/lib/db";
import { displayName } from "@/lib/hiscores/format";
import { defaultLooksStatement, parseDefaultLooks } from "@/lib/outfits/queries";

import { type BodyToken, parseBody } from "./body";
import { categorySlug } from "./categories";
import { type EventIcon, eventIcon } from "./events";
import {
  type Cursor,
  cursorOf,
  parseReplies,
  parseTimeline,
  repliesStatement,
  TIMELINE_PAGE,
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
    }
  | {
      kind: "update";
      key: string;
      id: number;
      at: string;
      tokens: BodyToken[];
      replyCount: number;
      replies: ReplyView[];
    };

export type TimelinePage = {
  entries: EntryView[];
  next: Cursor | null;
  /** Default looks by username, for the reply authors on this page. */
  looks: Record<string, Look>;
};

export async function loadTimeline(
  name: string,
  viewer: string | null,
  before: Cursor | null,
): Promise<TimelinePage> {
  const statement = timelineStatement(name, viewer, before);
  const page = parseTimeline(
    await query<Record<string, unknown>>(statement.text, statement.values),
  );

  const updateIds = page.rows.filter((row) => row.kind === "update").map((row) => row.id);
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
  const looks: Record<string, Look> = {};
  if (authors.length > 0) {
    const wanted = defaultLooksStatement(authors);
    for (const [username, look] of parseDefaultLooks(
      await query<Record<string, unknown>>(wanted.text, wanted.values),
    )) {
      looks[username] = look;
    }
  }

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

  const entries = page.rows.map((row): EntryView =>
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
        }
      : {
          kind: "update",
          key: `u${row.id}`,
          id: row.id,
          at: row.at,
          tokens: parseBody(row.body),
          replyCount: row.replyCount,
          replies: byUpdate.get(row.id) ?? [],
        },
  );

  const last = page.rows[page.rows.length - 1];
  return {
    entries,
    next: page.more && last ? cursorOf(last) : null,
    looks,
  };
}

export { TIMELINE_PAGE };
