"use client";

import ChatText from "@/components/game/ChatText";

import { usePersonaStage } from "./PersonaStage";

/** A copy of one of the page's other lines: it takes up its room, and is neither seen nor read. */
const HELD = { visibility: "hidden" } as const;

/**
 * Overhead chat: the line the figure is saying now (`PersonaStage`'s
 * `said`), in its page's colour and effect, as the game draws it. The card
 * puts it over the figure, or with no outfit in its chat strip (`strip`,
 * `al-chat-strip`); nothing is drawn, strip included, when the page has
 * nothing to say. Each line keeps the classes the headline had
 * (`al-overhead al-headline`), so skins written for it still land.
 *
 * Every line of the page is laid in one cell (`al-overhead-lines`), the one
 * being said over hidden, still copies of the rest, so the box is as tall as
 * the page's tallest line: a short line after one that wraps does not move
 * the figure, or anything under it. In a scene each line is laid over the
 * backdrop instead (`.al-scene .al-overhead`), so there it holds no room.
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
      {said.lines.map((text, index) =>
        index !== stage.line ? (
          <span key={index} style={HELD} aria-hidden="true">
            <ChatText className="al-overhead al-headline" text={text} colour={said.colour} effect={said.effect} still />
          </span>
        ) : said.text.trim() === "" ? null : (
          <ChatText
            key={said.key}
            className="al-overhead al-headline"
            text={said.text}
            colour={said.colour}
            effect={said.effect}
            onScrollWindow={stage.setScrollWindow}
          />
        ),
      )}
    </span>
  );
  return strip ? <p className="al-chat-strip">{lines}</p> : lines;
}
