"use client";

import { type KeyboardEvent, type PointerEvent, useRef } from "react";

import { DRAG_SLOP, dragSteps, stepFacing } from "@/lib/chathead/facing";

/** A drag in progress: its pointer, where it went down, the facing then, and whether it has moved. */
type Drag = { pointer: number; x: number; facing: number; moved: boolean };

export type TurnGesture = {
  /** Whether the figure turns at all: not where only one facing may be drawn. */
  canTurn: boolean;
  /** "Turn left": a step toward your left (+1). */
  turnLeft: () => void;
  /** "Turn right": a step toward your right (-1). */
  turnRight: () => void;
  /** Spread on the figure's button. */
  handlers: {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLElement>) => void;
    onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
    onClick: () => void;
  };
};

/**
 * Turning a figure by hand, one way everywhere: the log's card
 * (`CardFigure`) and the outfit editor's preview (`TurnableFigure`).
 *
 * - Drag it sideways with the primary button. The turn counts from the
 *   facing it had when the drag began (`dragSteps`: a step each 14 px, a
 *   drag right turning the face toward your right, so it follows the
 *   pointer). A press that moves no further than `DRAG_SLOP` stays a click;
 *   the click a drag ends with is swallowed, not passed to `onClick`.
 * - The left arrow and "Turn left" step +1, toward your left; the right
 *   arrow and "Turn right" step -1.
 * - With `turns` it walks only those facings, in their order
 *   (`stepFacing`); with one facing or none it does not turn at all.
 */
export function useTurnGesture({
  facing,
  setFacing,
  turns = null,
  onClick,
}: {
  /** The facing as drawn now: a drag or a step starts from it. */
  facing: number;
  setFacing: (facing: number) => void;
  /** The facings it may turn to, in order, or null for all sixteen. */
  turns?: readonly number[] | null;
  /** A click that did not end a drag (the card replays its emote). */
  onClick?: () => void;
}): TurnGesture {
  const drag = useRef<Drag | null>(null);
  /** Set when a drag ends: the click the browser sends after it is not a click. */
  const dragged = useRef(false);
  const canTurn = turns === null || turns.length > 1;

  const step = (delta: 1 | -1) => {
    if (canTurn) setFacing(stepFacing(facing, delta, turns));
  };

  const end = (event: PointerEvent<HTMLElement>) => {
    const now = drag.current;
    if (!now || now.pointer !== event.pointerId) return;
    dragged.current = now.moved;
    drag.current = null;
  };

  return {
    canTurn,
    turnLeft: () => step(1),
    turnRight: () => step(-1),
    handlers: {
      onPointerDown: (event) => {
        dragged.current = false;
        if (event.button !== 0 || !canTurn) return;
        drag.current = { pointer: event.pointerId, x: event.clientX, facing, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
      },
      onPointerMove: (event) => {
        const now = drag.current;
        if (!now || now.pointer !== event.pointerId) return;
        const dx = event.clientX - now.x;
        if (!now.moved && Math.abs(dx) <= DRAG_SLOP) return;
        now.moved = true;
        setFacing(stepFacing(now.facing, dragSteps(dx), turns));
      },
      onPointerUp: end,
      onPointerCancel: end,
      onKeyDown: (event) => {
        if (!canTurn) return;
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          step(1);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          step(-1);
        }
      },
      onClick: () => {
        if (dragged.current) {
          dragged.current = false;
          return;
        }
        onClick?.();
      },
    },
  };
}
