"use client";

import { type MouseEvent, useId } from "react";

import Chathead from "@/components/game/Chathead";
import ChatText from "@/components/game/ChatText";
import Figure from "@/components/game/Figure";
import MoodStill from "@/components/game/MoodStill";
import { typeLine, usedLines } from "@/lib/adventurer-log/character-draft";
import { type DialoguePage, PERSONA_LIMITS } from "@/lib/adventurer-log/persona";
import type { Look } from "@/lib/chathead/look";
import { MOOD_NAMES } from "@/lib/chathead/vocab";
import { CHAT_COLOUR_NAMES, CHAT_EFFECT_NAMES } from "@/lib/game-chat/effects";

import styles from "./Character.module.css";
import { usePersonaStage } from "./PersonaStage";
import { EmotePicker, MoodPicker } from "./StillPickers";

/** The row's chathead: the chathead frame at half size. */
const HEAD_SCALE = 0.5;

/** The effect picker's words for the game's three, in `CHAT_EFFECT_NAMES` order. */
const EFFECT_LABELS: Record<(typeof CHAT_EFFECT_NAMES)[number], string> = {
  none: "no effect",
  wave: "wave",
  scroll: "scroll",
};

/**
 * One page of the dialogue as one row, the way the page plays:
 * - on the left, the figure acting out the page's emote, with the emote
 *   picker under it;
 * - on the right, the dialogue's parchment: the chathead in the page's
 *   mood (a button that opens the mood picker), the name in dark red, and
 *   four line boxes in the game's font, with a count;
 * - under the parchment, how the page looks overhead: its colour (the
 *   game's twelve) and effect, and a sample of its first line in that look.
 *   A line typed the in-game way (`glow1:wave:hi`) sets them too
 *   (`typeLine`).
 *
 * Page 1 says what it is for: visitors see it first, and its first line is
 * the owner's greeting in Community lists.
 *
 * Clicking the row, or focusing one of its lines, makes it the stage's
 * current page (`goTo`): the stage plays its emote, and so does this row's
 * figure. Only the current row's chathead talks; the others are stills of
 * their mood. A pick plays the page too, current or not; a new colour or
 * effect on the current page only starts its lines again, so the emote is
 * not played over at every change.
 *
 * The figure stays mounted in every row. It is handed the stage's `replay`
 * only while its row is current - a change of `replay` plays it - and no
 * emote otherwise, so losing the stage just stands it again.
 */
export default function PageRow({
  index,
  count,
  page,
  name,
  outfitLook,
  headLook,
  invalid,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  page: DialoguePage;
  name: string;
  /** The worn outfit, for the figure; none draws no figure. */
  outfitLook: Look | null;
  /** The chathead's look. */
  headLook: Look | null;
  /** The save refused the dialogue: mark this page's lines and look. */
  invalid: boolean;
  onChange(page: DialoguePage): void;
  onMove(by: -1 | 1): void;
  onRemove(): void;
}) {
  const stage = usePersonaStage();
  const current = stage.page === index;
  const counterId = useId();
  const number = index + 1;
  const used = usedLines(page.lines);
  const sample = page.lines.find((line) => line.trim() !== "") ?? "Nothing said";

  function select() {
    if (!current) stage.goTo(index);
  }

  /** A pick changes the page and plays it, current or not. */
  function pickAndPlay(next: DialoguePage) {
    onChange(next);
    stage.goTo(index);
  }

  /** A new overhead look: plays the page if it was not current, else starts its lines again. */
  function restyle(next: DialoguePage) {
    onChange(next);
    stage.goTo(index, { play: !current });
  }

  /** The header's buttons act on their own and do not also select the row. */
  const tool = (action: () => void) => (event: MouseEvent) => {
    event.stopPropagation();
    action();
  };

  // The current row's head talks as the stage's does (the same line count);
  // the others hold a still of their mood.
  const face =
    current || !headLook ? (
      <Chathead
        look={headLook}
        mood={page.mood}
        lines={page.lines.length}
        scale={HEAD_SCALE}
        label={`${name}'s chathead, ${MOOD_NAMES[page.mood].toLowerCase()}`}
      />
    ) : (
      <MoodStill look={headLook} mood={page.mood} scale={HEAD_SCALE} />
    );

  return (
    <li
      className={current ? `${styles.pageRow} ${styles.pageRowCurrent}` : styles.pageRow}
      aria-current={current ? "true" : undefined}
      onClick={select}
    >
      <div className={styles.pageRowHead}>
        <span>
          Page {number}
          {index === 0 ? (
            <span className={styles.pageNote}>
              Visitors see this first. Its first line is your line in Community lists.
            </span>
          ) : null}
        </span>
        <span className={styles.tools}>
          <button type="button" onClick={tool(() => stage.goTo(index))} aria-label={`Play page ${number}`}>
            Play
          </button>
          <button type="button" onClick={tool(() => onMove(-1))} disabled={index === 0} aria-label={`Move page ${number} up`}>
            ↑
          </button>
          <button
            type="button"
            onClick={tool(() => onMove(1))}
            disabled={index === count - 1}
            aria-label={`Move page ${number} down`}
          >
            ↓
          </button>
          <button type="button" onClick={tool(onRemove)} aria-label={`Remove page ${number}`}>
            Remove
          </button>
        </span>
      </div>

      <div className={styles.pageRowBody}>
        <div className={styles.pageFigure}>
          <div className={styles.figureBox}>
            {outfitLook ? (
              <Figure
                look={outfitLook}
                scale={0.5}
                emote={current ? page.emote : null}
                replay={current ? stage.replay : undefined}
                label={`${name} acting out page ${number}`}
              />
            ) : (
              <span className={styles.noFigure}>Save an outfit to see your figure act it out.</span>
            )}
          </div>
          <EmotePicker look={outfitLook} value={page.emote} onPick={(emote) => pickAndPlay({ ...page, emote })} />
        </div>

        <div className={styles.pageWords}>
          <div className={styles.parchment}>
            <MoodPicker look={headLook} value={page.mood} face={face} onPick={(mood) => pickAndPlay({ ...page, mood })} />
            <div className={styles.parchmentText}>
              <p className={styles.speaker}>{name}</p>
              {Array.from({ length: PERSONA_LIMITS.lines }, (_, line) => (
                <input
                  key={line}
                  type="text"
                  className={styles.lineInput}
                  value={page.lines[line] ?? ""}
                  maxLength={PERSONA_LIMITS.line}
                  aria-label={`Page ${number}, line ${line + 1}`}
                  aria-describedby={counterId}
                  aria-invalid={invalid || undefined}
                  onFocus={select}
                  onChange={(event) => onChange(typeLine(page, line, event.target.value))}
                />
              ))}
              <p id={counterId} className={styles.counter}>
                {used}/{PERSONA_LIMITS.lines} lines
              </p>
            </div>
          </div>

          <div className={styles.overhead}>
            <span className={styles.overheadLabel} aria-hidden="true">
              Overhead
            </span>
            <select
              aria-label={`Page ${number}: overhead colour`}
              value={page.colour}
              aria-invalid={invalid || undefined}
              onChange={(event) => restyle({ ...page, colour: Number(event.target.value) })}
            >
              {CHAT_COLOUR_NAMES.map((colour, value) => (
                <option key={colour} value={value}>
                  {colour}
                </option>
              ))}
            </select>
            <select
              aria-label={`Page ${number}: overhead effect`}
              value={page.effect}
              aria-invalid={invalid || undefined}
              onChange={(event) => restyle({ ...page, effect: Number(event.target.value) })}
            >
              {CHAT_EFFECT_NAMES.map((effect, value) => (
                <option key={effect} value={value}>
                  {EFFECT_LABELS[effect]}
                </option>
              ))}
            </select>
            {/* A picture of the look: the line itself is in its box above. */}
            <span className={styles.sample} aria-hidden="true">
              <ChatText text={sample} colour={page.colour} effect={page.effect} />
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}
