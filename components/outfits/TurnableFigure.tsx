"use client";

import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";

import Figure from "@/components/game/Figure";
import { FACING_NAMES, stepFacing } from "@/lib/chathead/facing";
import type { Look } from "@/lib/chathead/look";

import styles from "./Outfits.module.css";

/** Pixels of drag per step of facing, as on the log's card. */
const DRAG_STEP = 14;

/**
 * The editor's whole-body preview, which turns: drag it (a step each
 * `DRAG_STEP` pixels), press ← or → on it, or use the two buttons. It draws
 * in the turn frame (`<Figure facing>`), so the canvas is one size at every
 * angle and nothing beside it moves as it turns. It starts facing you: the
 * editor is about the outfit, not the log's saved facing.
 *
 * It is a slider to assistive technology: sixteen values, each named
 * (`FACING_NAMES`), with the arrow keys stepping through them. The
 * direction matches the card's (`CardFigure`): ← and "Turn left" step +1,
 * turning the face toward your left; → and "Turn right" step -1; and
 * dragging right steps -1 each `DRAG_STEP` pixels, so the face follows the
 * pointer.
 */
export default function TurnableFigure({ look, label }: { look: Look; label: string }) {
  const [facing, setFacing] = useState(0);
  const drag = useRef<{ pointer: number; x: number; steps: number } | null>(null);

  function turn(by: number) {
    if (by === 0) return;
    setFacing((current) => {
      let next = current;
      for (let i = 0; i < Math.abs(by); i++) next = stepFacing(next, Math.sign(by));
      return next;
    });
  }

  function down(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointer: event.pointerId, x: event.clientX, steps: 0 };
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    const at = drag.current;
    if (!at || at.pointer !== event.pointerId) return;
    // Dragging right turns the face toward your right: facing down.
    const steps = -Math.trunc((event.clientX - at.x) / DRAG_STEP);
    if (steps === at.steps) return;
    turn(steps - at.steps);
    at.steps = steps;
  }

  function up(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointer === event.pointerId) drag.current = null;
  }

  function key(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      turn(1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      turn(-1);
    }
  }

  return (
    <div className={styles.turn}>
      <div
        role="slider"
        tabIndex={0}
        aria-label={`Turn ${label}`}
        aria-valuemin={0}
        aria-valuemax={FACING_NAMES.length - 1}
        aria-valuenow={facing}
        aria-valuetext={FACING_NAMES[facing]}
        className={styles.turnable}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
      >
        <Figure look={look} facing={facing} label={label} />
      </div>
      <div className={styles.turnButtons}>
        <button type="button" aria-label="Turn left" onClick={() => turn(1)}>
          ◀
        </button>
        <button type="button" aria-label="Turn right" onClick={() => turn(-1)}>
          ▶
        </button>
      </div>
    </div>
  );
}
