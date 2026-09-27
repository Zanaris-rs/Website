"use client";

import { useState } from "react";

import Figure from "@/components/game/Figure";
import { useTurnGesture } from "@/components/game/useTurnGesture";
import type { Look } from "@/lib/chathead/look";

import styles from "./Outfits.module.css";

/**
 * The editor's whole-body preview, which turns exactly as the log's card
 * does (`useTurnGesture`, shared with `CardFigure`): drag it sideways (a step
 * each 14 px from where the drag began, the face following the pointer),
 * press ← or → on it, or use the two buttons - ← and "Turn left" turn the
 * face toward your left, → and "Turn right" toward your right. It draws in
 * the turn frame (`<Figure facing>`), so the canvas is one size at every
 * angle and nothing beside it moves as it turns. It starts facing you: the
 * editor is about the outfit, not the log's saved facing.
 *
 * As on the card, the figure is a button whose arrow keys are announced
 * (`aria-keyshortcuts`); clicking it does nothing more.
 */
export default function TurnableFigure({ look, label }: { look: Look; label: string }) {
  const [facing, setFacing] = useState(0);
  const gesture = useTurnGesture({ facing, setFacing });

  return (
    <div className={styles.turn}>
      <button
        type="button"
        className={styles.turnable}
        {...gesture.handlers}
        aria-keyshortcuts="ArrowLeft ArrowRight"
        aria-label={`Turn ${label}`}
      >
        <Figure look={look} facing={facing} label={label} />
      </button>
      <div className={styles.turnButtons}>
        <button type="button" aria-label="Turn left" onClick={gesture.turnLeft}>
          ◀
        </button>
        <button type="button" aria-label="Turn right" onClick={gesture.turnRight}>
          ▶
        </button>
      </div>
    </div>
  );
}
