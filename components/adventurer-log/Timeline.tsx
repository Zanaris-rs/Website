"use client";

import { useState } from "react";

import type { Cursor } from "@/lib/adventurer-log/queries";
import type { EntryView, TimelinePage } from "@/lib/adventurer-log/view";
import type { Look } from "@/lib/chathead/look";

import Entry from "./Entry";

/**
 * The timeline, newest first, and the button that reads the next page
 * (`GET /api/adventurer-log/<name>/timeline`). The first page arrives with
 * the page itself; the rest are the same shape from the route.
 */
export default function Timeline({
  username,
  ownerName,
  ownerLook,
  first,
  empty,
}: {
  username: string;
  ownerName: string;
  ownerLook: Look | null;
  first: TimelinePage;
  empty: string;
}) {
  const [entries, setEntries] = useState<EntryView[]>(first.entries);
  const [looks, setLooks] = useState<Record<string, Look>>(first.looks);
  const [next, setNext] = useState<Cursor | null>(first.next);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

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

  if (entries.length === 0) {
    return <p className="al-empty">{empty}</p>;
  }

  return (
    <>
      <ul className="al-entries">
        {entries.map((entry) => (
          <Entry
            key={entry.key}
            entry={entry}
            ownerName={ownerName}
            ownerLook={ownerLook}
            looks={looks}
          />
        ))}
      </ul>
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
