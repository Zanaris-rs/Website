"use client";

import ChatText from "@/components/game/ChatText";
import Figure from "@/components/game/Figure";
import type { Look } from "@/lib/chathead/look";

import { usePersonaStage } from "./PersonaStage";

/**
 * The headline sits outside the button, not inside it: a non-empty
 * `aria-label` on the button would replace its accessible name entirely
 * (the WAI-ARIA name algorithm), which would hide `ChatText`'s hidden plain
 * copy of the headline from screen readers - the exact thing that hidden
 * copy exists for. Keeping the headline as a sibling means it is read once,
 * plainly, the way it always was, and the button's own name only has to
 * describe what clicking it does.
 */
export default function CardFigure({
  name,
  look,
  headline,
  colour,
  effect,
}: {
  name: string;
  look: Look;
  headline: string;
  colour: number;
  effect: number;
}) {
  const stage = usePersonaStage();
  return (
    <>
      {headline ? <ChatText className="al-overhead al-headline" text={headline} colour={colour} effect={effect} /> : null}
      <button
        type="button"
        className="al-figure"
        onClick={stage.replayEmote}
        aria-label={stage.emote ? `${name}: play the emote again` : `${name}'s figure`}
      >
        <Figure look={look} label={`${name}'s figure`} emote={stage.emote} replay={stage.replay} />
      </button>
    </>
  );
}
