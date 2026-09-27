"use client";

import { useState } from "react";

import ChatText from "@/components/game/ChatText";
import Figure from "@/components/game/Figure";
import SceneFigure from "@/components/game/SceneFigure";
import { useTurnGesture } from "@/components/game/useTurnGesture";
import type { WardrobeOutfit } from "@/lib/adventurer-log/wardrobe";
import { nearestFacing } from "@/lib/chathead/facing";
import { type Look, lookKey } from "@/lib/chathead/look";
import type { SceneSpot } from "@/lib/scenes/spots";

import { usePersonaStage } from "./PersonaStage";

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
 * The figure turns (`PersonaStage`'s `facing`) by `useTurnGesture`, as the
 * outfit editor's figure does: drag it sideways - each 14 px a step, from
 * where the drag began; a drag of more than 4 px is a turn, and the click it
 * ends with does not replay the emote - press the left or right arrow on it,
 * or use the buttons under it. In a scene it turns only through the facings
 * the spot proved (`turns`); where that is only the one facing the camera,
 * the buttons are disabled. An emote plays at the angle the figure is
 * turned to.
 *
 * A reader trying on an outfit from the Wardrobe (`PersonaStage`'s `tryOn`)
 * sees the figure wear it, turned as it was, and a line under the turn
 * buttons naming it, with "back to usual".
 */
export default function CardFigure({
  name,
  look,
  headline,
  colour,
  effect,
  scene,
  outfits = [],
}: {
  name: string;
  look: Look;
  headline: string;
  colour: number;
  effect: number;
  /** The spot the figure stands in, or null for the plain figure frame. */
  scene: SceneSpot | null;
  /** The Wardrobe's outfits, to name the one a reader is trying on. */
  outfits?: readonly WardrobeOutfit[];
}) {
  const stage = usePersonaStage();
  const [failed, setFailed] = useState<string | null>(null);
  const shown = scene && failed !== scene.key ? scene : null;
  // The steps a turn walks: the picked scene's proved facings - also while
  // its plain figure stands in, so a drag agrees with the stage - or all.
  const turns = scene?.turns ?? null;
  const facing = shown ? nearestFacing(stage.facing, shown.turns) : stage.facing;

  // What the figure wears: an outfit a reader is trying on, or the owner's.
  // Both are the page's own look objects, so the drawings kept per look stay put.
  const worn = stage.tryOn ?? look;
  const trying = stage.tryOn ? lookKey(stage.tryOn) : null;
  const tryingName =
    trying === null ? null : (outfits.find((outfit) => lookKey(outfit.look) === trying)?.name ?? "an outfit");

  const gesture = useTurnGesture({ facing, setFacing: stage.setFacing, turns, onClick: stage.replayEmote });

  const overhead = headline ? (
    <ChatText className="al-overhead al-headline" text={headline} colour={colour} effect={effect} />
  ) : null;
  const figure = (
    <button
      type="button"
      className="al-figure"
      {...gesture.handlers}
      aria-keyshortcuts={gesture.canTurn ? "ArrowLeft ArrowRight" : undefined}
      aria-label={stage.emote ? `${name}: play the emote again` : `${name}'s figure`}
    >
      {shown ? (
        <SceneFigure
          spot={shown}
          look={worn}
          facing={facing}
          label={`${name} at ${shown.name}`}
          emote={stage.emote}
          replay={stage.replay}
          onFail={() => setFailed(shown.key)}
        />
      ) : (
        <Figure look={worn} facing={facing} label={`${name}'s figure`} emote={stage.emote} replay={stage.replay} />
      )}
    </button>
  );
  const controls = (
    <div className="al-turn">
      <button type="button" className="al-turn-left" aria-label="Turn left" disabled={!gesture.canTurn} onClick={gesture.turnLeft}>
        <TurnIcon />
      </button>
      <span className="al-turn-hint">{stage.emote ? <>Drag to turn &middot; click to emote</> : "Drag to turn"}</span>
      <button type="button" className="al-turn-right" aria-label="Turn right" disabled={!gesture.canTurn} onClick={gesture.turnRight}>
        <TurnIcon right />
      </button>
    </div>
  );
  const trial =
    tryingName === null ? null : (
      <p className="al-tryon">
        Trying on {tryingName} &middot;{" "}
        <button type="button" className="al-tryon-back" onClick={() => stage.setTryOn(null)}>
          back to usual
        </button>
      </p>
    );

  return shown ? (
    <>
      <div className="al-scene">
        {overhead}
        {figure}
      </div>
      <p className="al-scene-name">{shown.name}</p>
      {controls}
      {trial}
    </>
  ) : (
    <>
      {overhead}
      {figure}
      {controls}
      {trial}
    </>
  );
}
