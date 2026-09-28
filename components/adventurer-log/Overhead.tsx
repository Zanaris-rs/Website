"use client";

import ChatText from "@/components/game/ChatText";

import { usePersonaStage } from "./PersonaStage";

/**
 * Overhead chat: the line the figure is saying now (`PersonaStage`'s
 * `said`), in its page's colour and effect, as the game draws it. The card
 * puts it over the figure, or in its chat strip when there is no outfit;
 * nothing is drawn when there is nothing to say. It keeps the classes the
 * headline had (`al-overhead al-headline`), so skins written for it still
 * land.
 *
 * Each line is a fresh `ChatText` (`key`), so a scroll starts its pass as
 * the line starts, and the stage hears the width of its scroll window
 * (`setScrollWindow`) to hold the line for exactly that pass.
 */
export default function Overhead() {
  const stage = usePersonaStage();
  if (!stage.said) return null;
  return (
    <ChatText
      key={stage.said.key}
      className="al-overhead al-headline"
      text={stage.said.text}
      colour={stage.said.colour}
      effect={stage.said.effect}
      onScrollWindow={stage.setScrollWindow}
    />
  );
}
