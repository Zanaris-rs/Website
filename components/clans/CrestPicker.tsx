"use client";

import { useEffect, useRef, useState } from "react";

import ItemIcon from "@/components/game/ItemIcon";

import styles from "./Clans.module.css";
import Crest from "./Crest";

type CrestOption = { id: number; name: string };

/** How long typing must pause before the search is sent, in ms. */
const SEARCH_DELAY = 200;

/** One search: the curated list for "", else the server's matches. Throws when it fails. */
async function fetchCrests(q: string): Promise<CrestOption[]> {
  const response = await fetch(`/api/clans/crests?q=${encodeURIComponent(q.trim())}`);
  if (!response.ok) throw new Error(`/api/clans/crests: HTTP ${response.status}`);
  const body = (await response.json()) as { crests?: CrestOption[] };
  return body.crests ?? [];
}

function withNames(known: Record<number, string>, found: readonly CrestOption[]): Record<number, string> {
  const next = { ...known };
  for (const option of found) next[option.id] = option.name;
  return next;
}

/**
 * Pick a crest: any item in the game. The shield shows the chosen one; a
 * search box asks the server (`/api/clans/crests`), which with nothing typed
 * answers the curated list. Answers fill a grid of a fixed size that
 * scrolls inside itself, so typing never moves the page. `name` is the
 * current crest's name, when the page knows it; `invalid` marks the search
 * box when the last save refused the crest.
 *
 * `describedBy` is the status line that says why, when it did.
 *
 * A search waits until typing pauses (`SEARCH_DELAY`), so a word is one
 * request, not one per letter. Enter in the search box never submits the
 * form the picker sits in. Only the newest search's answer is shown, the
 * first curated list included, so a slow answer never replaces a newer one.
 */
export default function CrestPicker({
  value,
  onChange,
  name,
  invalid,
  describedBy,
}: {
  value: number;
  onChange(id: number): void;
  name?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<CrestOption[]>([]);
  const [names, setNames] = useState<Record<number, string>>(name ? { [value]: name } : {});
  const [failed, setFailed] = useState(false);
  const searchSeq = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    let current = true;
    fetchCrests("")
      .then((found) => {
        // Typing started a newer search: its answer wins.
        if (!current || searchSeq.current !== 0) return;
        setOptions(found);
        setNames((known) => withNames(known, found));
      })
      .catch((error: unknown) => {
        console.error("[clans] the crest list failed to load:", error);
        if (current && searchSeq.current === 0) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, []);

  // A search not yet sent is dropped with the picker.
  useEffect(() => () => clearTimeout(pending.current), []);

  function search(next: string) {
    setQuery(next);
    // Counted now, so the first curated answer and any older search lose.
    const seq = ++searchSeq.current;
    clearTimeout(pending.current);
    pending.current = setTimeout(() => void answer(next, seq), SEARCH_DELAY);
  }

  async function answer(q: string, seq: number) {
    try {
      const found = await fetchCrests(q);
      if (seq !== searchSeq.current) return;
      setOptions(found);
      setFailed(false);
      setNames((known) => withNames(known, found));
    } catch (error) {
      console.error("[clans] a crest search failed:", error);
      if (seq === searchSeq.current) {
        setOptions([]);
        setFailed(true);
      }
    }
  }

  const current = names[value];
  return (
    <div className={styles.crestPicker}>
      <div className={styles.crestPreview}>
        <Crest id={value} size="m" label={current ? `Crest: ${current}` : "Clan crest"} />
        <span>{current ?? ""}</span>
      </div>
      <div className={styles.crestSearch}>
        <input
          type="search"
          placeholder="Search every item"
          aria-label="Search for a crest"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          maxLength={40}
          value={query}
          onChange={(event) => search(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
        />
        <div className={styles.crestGrid}>
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={styles.crestOption}
              aria-pressed={option.id === value}
              aria-label={option.name}
              title={option.name}
              onClick={() => onChange(option.id)}
            >
              <ItemIcon id={option.id} size={32} />
            </button>
          ))}
          {options.length === 0 ? (
            <p className={styles.gridNote}>
              {failed ? "The item list is unavailable right now." : query.trim() !== "" ? "No item by that name." : ""}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
