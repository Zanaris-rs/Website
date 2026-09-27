"use client";

import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";

import ChatText from "@/components/game/ChatText";
import Figure from "@/components/game/Figure";
import SceneFigure from "@/components/game/SceneFigure";
import { FACING_NAMES, nearestFacing, stepFacing } from "@/lib/chathead/facing";
import type { Look } from "@/lib/chathead/look";
import type { SceneSpot } from "@/lib/scenes/spots";

import { usePersonaStage } from "./PersonaStage";

/** How far a drag goes, in CSS pixels, for each step the figure turns. */
const DRAG_STEP = 14;
/** A press that moves no further than this stays a click, which replays the emote. */
const DRAG_SLOP = 4;

/** A drag in progress: its pointer, where it went down, the facing then, and whether it has moved. */
type Drag = { pointer: number; x: number; facing: number; moved: boolean };

/** A turning arrow; `right` mirrors it. */
function TurnIcon({ right = false }: { right?: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {right ? (
        <>
          <path d="M10.8 8.5a4.2 4.2 0 1 1-1.1-4.6" />
          <path d="M10.4 1.6v2.9H7.5" />
        </>
      ) : (
        <>
          <path d="M3.2 8.5a4.2 4.2 0 1 0 1.1-4.6" />
          <path d="M3.6 1.6v2.9h2.9" />
        </>
      )}
    </svg>
  );
}

/**
 * The headline sits outside the button, not inside it: a non-empty
 * `aria-label` on the button would replace its accessible name entirely
 * (the WAI-ARIA name algorithm), which would hide `ChatText`'s hidden plain
 * copy of the headline from screen readers - the exact thing that hidden
 * copy exists for. Keeping the headline as a sibling means it is read once,
 * plainly, the way it always was, and the button's own name only has to
 * describe what clicking it does.
 *
 * With a scene, the two sit in its frame (`al-scene`), in the same order:
 * the headline over the figure's head, as the game draws overhead chat, and
 * the figure standing in the spot, with the spot's name under the frame. The
 * look is passed straight through, as the figures' drawings are kept per
 * look. A scene that fails to load (`SceneFigure`'s `onFail`) gives way to
 * the plain figure, as if no scene were picked.
 *
 * The figure turns (`PersonaStage`'s `facing`): drag it sideways - each 14
 * px a step, from where the drag began; a drag of more than 4 px is a turn,
 * and the click it ends with does not replay the emote - press the left or
 * right arrow on it, or use the buttons under it. In a scene it turns only
 * through the facings the spot proved (`turns`); where that is only the one
 * facing the camera, the buttons are disabled and the hint is left out. An
 * emote plays at the angle the figure is turned to. Once a reader turns it,
 * a hidden polite live line (`al-turn-said`) says which way it now faces
 * (`FACING_NAMES`), so a turn is heard as well as seen.
 */
export default function CardFigure({
  name,
  look,
  headline,
  colour,
  effect,
  scene,
}: {
  name: string;
  look: Look;
  headline: string;
  colour: number;
  effect: number;
  /** The spot the figure stands in, or null for the plain figure frame. */
  scene: SceneSpot | null;
}) {
  const stage = usePersonaStage();
  const [failed, setFailed] = useState<string | null>(null);
  const drag = useRef<Drag | null>(null);
  /** Set when a drag ends: the click the browser sends after it is not a replay. */
  const dragged = useRef(false);
  const shown = scene && failed !== scene.key ? scene : null;
  // The steps a turn walks: the picked scene's proved facings - also while
  // its plain figure stands in, so a drag agrees with the stage - or all.
  const turns = scene?.turns ?? null;
  const facing = shown ? nearestFacing(stage.facing, shown.turns) : stage.facing;
  const canTurn = turns === null || turns.length > 1;
  /** Set by the first turn by hand: until then the live line stays empty, so nothing is said on load. */
  const [turned, setTurned] = useState(false);
  const turnTo = (next: number) => {
    if (next !== facing) setTurned(true);
    stage.setFacing(next);
  };
  const turnBy = (delta: 1 | -1) => {
    setTurned(true);
    stage.turn(delta);
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    dragged.current = false;
    if (event.button !== 0 || !canTurn) return;
    drag.current = { pointer: event.pointerId, x: event.clientX, facing, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const now = drag.current;
    if (!now || now.pointer !== event.pointerId) return;
    const dx = event.clientX - now.x;
    if (!now.moved && Math.abs(dx) <= DRAG_SLOP) return;
    now.moved = true;
    // Dragging right turns the figure's face toward your right: facing down.
    turnTo(stepFacing(now.facing, -Math.round(dx / DRAG_STEP), turns));
  };
  const onPointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    const now = drag.current;
    if (!now || now.pointer !== event.pointerId) return;
    dragged.current = now.moved;
    drag.current = null;
  };
  const onClick = () => {
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    stage.replayEmote();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!canTurn) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      turnBy(1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      turnBy(-1);
    }
  };

  const overhead = headline ? (
    <ChatText className="al-overhead al-headline" text={headline} colour={colour} effect={effect} />
  ) : null;
  const figure = (
    <button
      type="button"
      className="al-figure"
      onClick={onClick}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      aria-keyshortcuts={canTurn ? "ArrowLeft ArrowRight" : undefined}
      aria-label={stage.emote ? `${name}: play the emote again` : `${name}'s figure`}
    >
      {shown ? (
        <SceneFigure
          spot={shown}
          look={look}
          facing={facing}
          label={`${name} at ${shown.name}`}
          emote={stage.emote}
          replay={stage.replay}
          onFail={() => setFailed(shown.key)}
        />
      ) : (
        <Figure look={look} facing={facing} label={`${name}'s figure`} emote={stage.emote} replay={stage.replay} />
      )}
    </button>
  );
  const controls = (
    <div className="al-turn">
      <button type="button" className="al-turn-left" aria-label="Turn left" disabled={!canTurn} onClick={() => turnBy(1)}>
        <TurnIcon />
      </button>
      {canTurn ? (
        <span className="al-turn-hint">{stage.emote ? <>Drag to turn &middot; click to emote</> : "Drag to turn"}</span>
      ) : null}
      <button type="button" className="al-turn-right" aria-label="Turn right" disabled={!canTurn} onClick={() => turnBy(-1)}>
        <TurnIcon right />
      </button>
      <span className="al-turn-said" aria-live="polite">
        {turned ? FACING_NAMES[facing] : ""}
      </span>
    </div>
  );

  return shown ? (
    <>
      <div className="al-scene">
        {overhead}
        {figure}
      </div>
      <p className="al-scene-name">{shown.name}</p>
      {controls}
    </>
  ) : (
    <>
      {overhead}
      {figure}
      {controls}
    </>
  );
}
