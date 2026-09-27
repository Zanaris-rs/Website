"use client";

import ChatText from "@/components/game/ChatText";
import { CHAT_COLOUR_NAMES, CHAT_EFFECT_NAMES } from "@/lib/game-chat/effects";

import styles from "./CharacterEditor.module.css";

const EFFECT_LABELS: Record<(typeof CHAT_EFFECT_NAMES)[number], string> = {
  none: "None",
  wave: "Wave",
  scroll: "Scroll",
};

/**
 * The headline's colour and effect, the game's twelve and three: each colour
 * chip is its own name drawn in that colour (flashing or glowing, as it
 * will), and the effects are a three-way switch.
 */
export default function ColourPicker({
  colour,
  effect,
  onColour,
  onEffect,
}: {
  colour: number;
  effect: number;
  onColour(colour: number): void;
  onEffect(effect: number): void;
}) {
  return (
    <>
      <div className={styles.row}>
        <span className={styles.label} aria-hidden="true">
          Colour
        </span>
        <div role="group" aria-label="Colour" className={styles.chips}>
          {CHAT_COLOUR_NAMES.map((name, index) => (
            <button
              key={name}
              type="button"
              className={styles.chip}
              aria-label={name}
              aria-pressed={colour === index}
              onClick={() => onColour(index)}
            >
              <ChatText text={name} colour={index} effect={0} />
            </button>
          ))}
        </div>
      </div>
      <div className={styles.row}>
        <span className={styles.label} aria-hidden="true">
          Effect
        </span>
        <div role="group" aria-label="Effect" className={styles.segments}>
          {CHAT_EFFECT_NAMES.map((name, index) => (
            <button key={name} type="button" aria-pressed={effect === index} onClick={() => onEffect(index)}>
              {EFFECT_LABELS[name]}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
