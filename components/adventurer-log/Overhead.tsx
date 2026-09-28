"use client";

import ChatText from "@/components/game/ChatText";

import { usePersonaStage } from "./PersonaStage";

/** A copy of one of the pages' lines: it takes up its room, and is neither seen nor read. */
const HELD = { visibility: "hidden" } as const;

/**
 * Overhead chat: the line the figure is saying now (`PersonaStage`'s
 * `said`), in its page's colour and effect, as the game draws it. The card
 * puts it over the figure, or with no outfit in its chat strip (`strip`,
 * `al-chat-strip`); nothing is drawn, strip included, when the page has
 * nothing to say. Each line keeps the classes the headline had
 * (`al-overhead al-headline`), so skins written for it still land.
 *
 * Every line of every page is laid in one cell (`al-overhead-lines`) as a
 * hidden, still copy in its page's colour and effect (`Said.held`), and the
 * line being said over them, so the box is as tall as the tallest line of
 * any page: a short line after one that wraps, or the next page, does not
 * move the figure or anything under it. In a scene each line is laid over
 * the backdrop instead (`.al-scene .al-overhead`), so there it holds no room.
 *
 * The line being said is a fresh `ChatText` (`key`), so a scroll starts its
 * pass as the line starts, and the stage hears the width of its scroll
 * window (`setScrollWindow`) to hold the line for exactly that pass.
 */
export default function Overhead({ strip = false }: { strip?: boolean }) {
  const stage = usePersonaStage();
  const said = stage.said;
  if (!said) return null;
  const lines = (
    <span className="al-overhead-lines">
      {said.held.map((line) => (
        <span key={line.key} style={HELD} aria-hidden="true">
          <ChatText className="al-overhead al-headline" text={line.text} colour={line.colour} effect={line.effect} still />
        </span>
      ))}
      {said.text.trim() === "" ? null : (
        <ChatText
          key={said.key}
          className="al-overhead al-headline"
          text={said.text}
          colour={said.colour}
          effect={said.effect}
          onScrollWindow={stage.setScrollWindow}
        />
      )}
    </span>
  );
  return strip ? <p className="al-chat-strip">{lines}</p> : lines;
}
