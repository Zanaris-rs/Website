"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

import EmoteStill from "@/components/game/EmoteStill";
import MoodStill from "@/components/game/MoodStill";
import type { Look } from "@/lib/chathead/look";
import { type Emote, EMOTE_NAMES, EMOTES, type Mood, MOOD_NAMES, MOODS } from "@/lib/chathead/vocab";

import styles from "./Character.module.css";

/**
 * A button, and the overlay of choices it opens: drawn over the rows, out of
 * their flow, so opening it moves nothing. Escape, a press anywhere
 * outside, focus moving outside, or a choice closes it; Escape and a choice
 * give the focus back to the button. The chosen choice takes the focus as it
 * opens.
 */
function Picker({
  label,
  face,
  faceLabel,
  faceClassName,
  overlayClassName,
  children,
}: {
  label: string;
  face: ReactNode;
  faceLabel: string;
  faceClassName: string;
  overlayClassName: string;
  children: (choose: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  // Bumped by a close that gives the focus back to the button: the choices
  // are rendered with `close` in hand, so it only sets state, and the focus
  // moves once the overlay has gone.
  const [giveBack, setGiveBack] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setGiveBack((count) => count + 1);
  }, []);

  useEffect(() => {
    if (giveBack > 0) button.current?.focus();
  }, [giveBack]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => !(event.target instanceof Node && wrap.current?.contains(event.target));
    const press = (event: PointerEvent) => {
      if (outside(event)) setOpen(false);
    };
    // Tabbing out of it: the overlay would otherwise sit over the next row.
    const focus = (event: FocusEvent) => {
      if (outside(event)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", press);
    document.addEventListener("focusin", focus);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", press);
      document.removeEventListener("focusin", focus);
      document.removeEventListener("keydown", key);
    };
  }, [open, close]);

  return (
    <div ref={wrap} className={styles.pickerWrap}>
      <button
        ref={button}
        type="button"
        className={faceClassName}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={faceLabel}
        onClick={() => setOpen((was) => !was)}
      >
        {face}
      </button>
      {open ? (
        <div role="dialog" aria-label={label} className={`${styles.overlay} ${overlayClassName}`}>
          {children(close)}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A page's emote: the button reads its name and ▾. The overlay has thirteen
 * choices - None and the twelve emotes - each a still of the emote's middle
 * frame in the owner's outfit (names alone without one).
 */
export function EmotePicker({
  look,
  value,
  onPick,
}: {
  look: Look | null;
  value: Emote | null;
  onPick(emote: Emote | null): void;
}) {
  const name = value ? EMOTE_NAMES[value] : "No emote";
  return (
    <Picker
      label="Emotes"
      face={<>{name} ▾</>}
      faceLabel={`Emote: ${name}. Choose another`}
      faceClassName={styles.pickButton}
      overlayClassName={styles.emoteOverlay}
    >
      {(choose) => (
        <ul className={styles.choices}>
          {[null, ...EMOTES].map((emote) => (
            <li key={emote ?? "none"}>
              <button
                type="button"
                className={styles.choice}
                aria-pressed={emote === value}
                autoFocus={emote === value}
                onClick={() => {
                  onPick(emote);
                  choose();
                }}
              >
                {look ? <EmoteStill look={look} emote={emote} scale={0.4} /> : <span className={styles.noStill} />}
                <span className={styles.choiceName}>{emote ? EMOTE_NAMES[emote] : "None"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Picker>
  );
}

/**
 * A page's mood: the button is the row's chathead (`face`). The overlay has
 * the fourteen moods, each a still of the chathead in it.
 */
export function MoodPicker({
  look,
  value,
  face,
  onPick,
}: {
  look: Look | null;
  value: Mood;
  face: ReactNode;
  onPick(mood: Mood): void;
}) {
  return (
    <Picker
      label="Moods"
      face={face}
      faceLabel={`Mood: ${MOOD_NAMES[value]}. Choose another`}
      faceClassName={styles.moodButton}
      overlayClassName={styles.moodOverlay}
    >
      {(choose) => (
        <ul className={styles.choices}>
          {MOODS.map((mood) => (
            <li key={mood}>
              <button
                type="button"
                className={styles.choice}
                aria-pressed={mood === value}
                autoFocus={mood === value}
                onClick={() => {
                  onPick(mood);
                  choose();
                }}
              >
                {look ? <MoodStill look={look} mood={mood} scale={0.5} /> : <span className={styles.noHead} />}
                <span className={styles.choiceName}>{MOOD_NAMES[mood]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Picker>
  );
}
