"use client";

import ChatText from "@/components/game/ChatText";
import Figure from "@/components/game/Figure";
import SceneFigure from "@/components/game/SceneFigure";
import type { Look } from "@/lib/chathead/look";
import type { SceneSpot } from "@/lib/scenes/spots";

import { usePersonaStage } from "./PersonaStage";

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
 * the figure standing in the spot. The look is passed straight through, as
 * the figures' drawings are kept per look.
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
  const overhead = headline ? (
    <ChatText className="al-overhead al-headline" text={headline} colour={colour} effect={effect} />
  ) : null;
  const figure = (
    <button
      type="button"
      className="al-figure"
      onClick={stage.replayEmote}
      aria-label={stage.emote ? `${name}: play the emote again` : `${name}'s figure`}
    >
      {scene ? (
        <SceneFigure
          spot={scene}
          look={look}
          label={`${name} at ${scene.name}`}
          emote={stage.emote}
          replay={stage.replay}
        />
      ) : (
        <Figure look={look} label={`${name}'s figure`} emote={stage.emote} replay={stage.replay} />
      )}
    </button>
  );

  return scene ? (
    <div className="al-scene">
      {overhead}
      {figure}
    </div>
  ) : (
    <>
      {overhead}
      {figure}
    </>
  );
}
