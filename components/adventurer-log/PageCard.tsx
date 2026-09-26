"use client";

import { useId } from "react";

import { longLines, pageLines } from "@/lib/adventurer-log/character-draft";
import { type DialoguePage, PERSONA_LIMITS } from "@/lib/adventurer-log/persona";
import { type Emote, EMOTE_NAMES, EMOTES, type Mood, MOOD_NAMES, MOODS } from "@/lib/chathead/vocab";

import styles from "./CharacterEditor.module.css";

/**
 * One page of the dialogue: the mood the chathead talks in, the emote the
 * figure acts out, and up to four lines - one per line typed - with a
 * counter that flags a line too long to save.
 */
export default function PageCard({
  index,
  count,
  page,
  invalid,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  page: DialoguePage;
  /** The save refused the dialogue: mark this page's controls. */
  invalid: boolean;
  onChange(page: DialoguePage): void;
  onMove(by: -1 | 1): void;
  onRemove(): void;
}) {
  const counterId = useId();
  const number = index + 1;
  const long = longLines(page.lines);
  let used = page.lines.length;
  while (used > 0 && page.lines[used - 1].trim() === "") used--;

  return (
    <li className={styles.pageCard}>
      <div className={styles.pageHead}>
        <span>Page {number}</span>
        <span className={styles.tools}>
          <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move page ${number} up`}>
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === count - 1}
            aria-label={`Move page ${number} down`}
          >
            ↓
          </button>
          <button type="button" onClick={onRemove} aria-label={`Remove page ${number}`}>
            Remove
          </button>
        </span>
      </div>

      <div className={styles.picks}>
        <label>
          <span className={styles.label}>Mood</span>
          <select value={page.mood} onChange={(event) => onChange({ ...page, mood: event.target.value as Mood })}>
            {MOODS.map((mood) => (
              <option key={mood} value={mood}>
                {MOOD_NAMES[mood]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className={styles.label}>Emote</span>
          <select
            value={page.emote ?? ""}
            aria-invalid={invalid || undefined}
            onChange={(event) => onChange({ ...page, emote: (event.target.value || null) as Emote | null })}
          >
            <option value="">No emote</option>
            {EMOTES.map((emote) => (
              <option key={emote} value={emote}>
                {EMOTE_NAMES[emote]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className={styles.lines}>
        <span className={styles.label}>What you say</span>
        <textarea
          aria-label={`Page ${number}: what you say`}
          rows={PERSONA_LIMITS.lines}
          wrap="off"
          value={page.lines.join("\n")}
          aria-describedby={counterId}
          aria-invalid={invalid || long.length > 0 || undefined}
          onChange={(event) => onChange({ ...page, lines: pageLines(event.target.value) })}
        />
      </label>
      <p id={counterId} className={styles.counter}>
        {used}/{PERSONA_LIMITS.lines} lines
        {long.map((line) => (
          <span key={line} className={styles.warn}>
            Line {line + 1} is {page.lines[line].trim().length} characters; a line can be at most{" "}
            {PERSONA_LIMITS.line}.
          </span>
        ))}
      </p>
    </li>
  );
}
