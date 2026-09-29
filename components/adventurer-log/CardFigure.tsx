"use client";

import { useState } from "react";

import Figure from "@/components/game/Figure";
import SceneFigure from "@/components/game/SceneFigure";
import { useTurnGesture } from "@/components/game/useTurnGesture";
import type { WardrobeOutfit } from "@/lib/adventurer-log/wardrobe";
import { nearestFacing } from "@/lib/chathead/facing";
import { type Look, lookKey } from "@/lib/chathead/look";
import type { SceneSpot } from "@/lib/scenes/spots";

import Overhead from "./Overhead";
import { usePersonaStage } from "./PersonaStage";

/**
 * The overhead chat (`Overhead`: the line of the current dialogue page the
 * figure is saying now, in the page's colour and effect) sits outside the
 * button, not inside it: a non-empty `aria-label` on the button would
 * replace its accessible name entirely (the WAI-ARIA name algorithm), which
 * would hide `ChatText`'s hidden plain copy of the line from screen readers
 * - the exact thing that hidden copy exists for. Keeping it as a sibling
 * means it is read once, plainly, and the button's own name only has to
 * describe what clicking it does.
 *
 * With a scene, the two sit in its frame (`al-scene`), in the same order:
 * the line over the figure's head, as the game draws overhead chat, and
 * the figure standing in the spot, with the spot's name under the frame. The
 * look is passed straight through, as the figures' drawings are kept per
 * look. A scene that fails to load (`SceneFigure`'s `onFail`) gives way to
 * the plain figure, as if no scene were picked.
 *
 * The figure turns (`PersonaStage`'s `facing`) by `useTurnGesture`, as the
 * outfit editor's figure does: drag it sideways - each 14 px a step, from
 * where the drag began; a drag of more than 4 px is a turn, and the click it
 * ends with does not replay the emote - or press the left or right arrow on
 * it. There are no turn buttons: the hint under the figure says how, and
 * only where it can turn. In a scene it turns only through the facings the
 * spot proved (`turns`); where that is only the one facing the camera, the
 * hint is left out. An emote plays at the angle the figure is turned to.
 * Once a reader turns it, a hidden polite live line (`al-turn-said`, the
 * gesture's `said`) says which way it now faces, so a turn is heard as well
 * as seen.
 *
 * A reader trying on an outfit from the Wardrobe (`PersonaStage`'s `tryOn`)
 * sees the figure wear it, turned as it was; clicking it again, or the one
 * they usually wear, goes back. Nothing on the card says so in words: a
 * hidden polite live line (`al-tryon`) tells a screen reader "<name> is
 * wearing <outfit>." for the outfit the figure has on.
 */
export default function CardFigure({
  name,
  look,
  scene,
  outfits = [],
}: {
  name: string;
  look: Look;
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
  // Its name, for the live line: the Wardrobe's, or "an outfit" for a tried-on
  // look it has no name for; nothing for the usual look when it has none.
  const wornKey = lookKey(worn);
  const wornName =
    outfits.find((outfit) => lookKey(outfit.look) === wornKey)?.name ?? (stage.tryOn ? "an outfit" : null);

  const gesture = useTurnGesture({ facing, setFacing: stage.setFacing, turns, onClick: stage.replayEmote });

  const overhead = <Overhead />;
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
  // Under the figure: how to turn it, only where it can, and the hidden
  // line that says which way it faces after a turn.
  const controls = (
    <div className="al-turn">
      {gesture.canTurn ? (
        <span className="al-turn-hint">{stage.emote ? <>Drag to turn &middot; click to emote</> : "Drag to turn"}</span>
      ) : null}
      <span className="al-turn-said" aria-live="polite">
        {gesture.said}
      </span>
    </div>
  );
  // A polite live region, hidden like `al-turn-said`: a screen reader hears
  // the outfit change as a reader tries one on and goes back. It is always in
  // the page, since a region only speaks for changes made after it is there.
  const trial = (
    <p className="al-tryon" aria-live="polite">
      {wornName === null ? null : `${name} is wearing ${wornName}.`}
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
