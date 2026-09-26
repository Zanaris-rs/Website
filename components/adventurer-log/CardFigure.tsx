"use client";

import ChatText from "@/components/game/ChatText";
import Figure from "@/components/game/Figure";
import type { Look } from "@/lib/chathead/look";

import { usePersonaStage } from "./PersonaStage";

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
    <button
      type="button"
      className="al-figure"
      onClick={stage.replayEmote}
      aria-label={stage.emote ? `${name}: play the emote again` : `${name}'s figure`}
    >
      {headline ? <ChatText className="al-overhead al-headline" text={headline} colour={colour} effect={effect} /> : null}
      <Figure look={look} label={`${name}'s figure`} emote={stage.emote} replay={stage.replay} />
    </button>
  );
}
