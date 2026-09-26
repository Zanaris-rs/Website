"use client";

import "./game-fonts.css";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { onCycle, prefersReducedMotion, subscribeReducedMotion } from "@/lib/game-chat/clock";
import { colourAt, cssColour, scrollOffset, waveOffset, waveRuns } from "@/lib/game-chat/effects";
import { FONT_METRICS, stringWidth } from "@/lib/game-chat/metrics";

/** b12's height in pixels: at this size one game pixel is one CSS pixel. */
const B12 = FONT_METRICS.fonts.b12.height;

const HIDDEN = {
  position: "absolute", width: 1, height: 1, overflow: "hidden",
  clip: "rect(0 0 0 0)", whiteSpace: "nowrap",
} as const;

/**
 * A wave word is one box, so the line breaks only around it, never between
 * its letters - unless the word alone is wider than the line, when the box
 * stops at the line's width and its letters wrap inside it.
 */
const WAVE_WORD = { display: "inline-block", maxWidth: "100%" } as const;
const WAVE_CHAR = { display: "inline-block" } as const;

/** Off on the server and in the first render, so hydration matches. */
const serverReducedMotion = () => false;

/**
 * A line of overhead chat as the game draws it: the b12 font, a black shadow
 * one pixel down, one of the client's twelve colours and its wave or scroll.
 * Screen readers get the text once, plainly; the drawn copy is hidden from
 * them. With reduced motion nothing moves: a flash or glow shows its first
 * colour, and a wave or scroll is drawn as plain, still text.
 *
 * A long line wraps between words; a wave's spaces stay text so it can. A
 * scroll keeps its one-line window, and starts with its text at the
 * window's left edge, so it reads before the clock moves it (without script,
 * too).
 */
export default function ChatText({
  text,
  colour,
  effect,
  className,
}: {
  text: string;
  colour: number;
  effect: number;
  className?: string;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const reduced = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, serverReducedMotion);
  const moving = colour >= 6 || effect !== 0;
  const drawnEffect = reduced ? 0 : effect;

  useEffect(() => {
    const element = root.current;
    if (!element || !moving) return;
    if (reduced) {
      // The setting can change while the clock is running.
      element.style.color = cssColour(colourAt(colour, 0));
      return;
    }
    const chars = [...element.querySelectorAll<HTMLSpanElement>("[data-i]")].map(
      (span) => [span, Number(span.dataset.i)] as const,
    );
    const slider = element.querySelector<HTMLSpanElement>("[data-scroll]");
    const width = stringWidth(text, "b12");
    return onCycle((cycle) => {
      element.style.color = cssColour(colourAt(colour, cycle));
      if (effect === 1) {
        for (const [span, i] of chars) span.style.transform = `translateY(${waveOffset(i, cycle)}px)`;
      } else if (effect === 2 && slider) {
        slider.style.transform = `translateX(${100 - scrollOffset(width, cycle)}px)`;
      }
    });
  }, [text, colour, effect, moving, reduced]);

  const classes = `al-chat al-chat--c${colour} al-chat--e${effect}${className ? ` ${className}` : ""}`;
  const drawn =
    drawnEffect === 1 ? (
      waveRuns(text).map((run, r) =>
        run.kind === "space" ? (
          run.text
        ) : (
          <span key={r} style={WAVE_WORD}>
            {run.chars.map(({ ch, i }) => (
              <span key={i} data-i={i} style={WAVE_CHAR}>
                {ch}
              </span>
            ))}
          </span>
        ),
      )
    ) : drawnEffect === 2 ? (
      <span style={{ display: "inline-block", width: 100, overflow: "hidden", verticalAlign: "bottom" }}>
        <span data-scroll style={{ display: "inline-block", whiteSpace: "pre", transform: "translateX(0px)" }}>
          {text}
        </span>
      </span>
    ) : (
      text
    );

  return (
    <span
      ref={root}
      className={classes}
      style={{
        fontFamily: '"Zanaris b12", Arial, sans-serif',
        fontSize: B12,
        color: cssColour(colourAt(colour, 0)),
        textShadow: "0 1px 0 #000",
        whiteSpace: "pre-wrap",
      }}
    >
      <span style={HIDDEN}>{text}</span>
      <span aria-hidden="true">{drawn}</span>
    </span>
  );
}
