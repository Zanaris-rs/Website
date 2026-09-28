"use client";

import "./game-fonts.css";

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";

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

/**
 * A scroll's window: one line high and the whole width of the box the line
 * is drawn in - a scene's frame, or the card's width - so the line crosses
 * all of it.
 */
const SCROLL_WINDOW = { display: "inline-block", width: "100%", overflow: "hidden", verticalAlign: "bottom" } as const;
const SCROLL_TEXT = { display: "inline-block", whiteSpace: "pre", transform: "translateX(0px)" } as const;

/** The client's own scroll window: the width used until the real one is measured. */
const GAME_WINDOW = 100;

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
 * scroll keeps its one-line window, as wide as the box it is in (measured
 * with a ResizeObserver; the game's 100 px until then), and moves at the
 * game's pixel speed, so a wider box takes proportionally longer to cross.
 * Its pass starts when the line appears, entering at the window's right
 * edge, where it is put before it is first painted; without script the
 * text sits at the window's left edge, so it reads. `onScrollWindow` hears
 * the window's width each time it is measured, so overhead chat can hold a
 * scroll line for exactly one pass (`lib/adventurer-log/overhead.ts`).
 * A `still` line is laid out as it would be drawn but never moves: overhead
 * chat's hidden copies of a page's other lines, which only hold its height.
 */
export default function ChatText({
  text,
  colour,
  effect,
  className,
  onScrollWindow,
  still = false,
}: {
  text: string;
  colour: number;
  effect: number;
  className?: string;
  /** Hears the scroll window's width in CSS pixels whenever it is measured; scroll only. */
  onScrollWindow?: (width: number) => void;
  /** Laid out as drawn, but never animated: its colour stays the first, and a wave or scroll stays put. */
  still?: boolean;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const scrollWindow = useRef<HTMLSpanElement>(null);
  /** The scroll window's width in CSS pixels, kept by a ResizeObserver. */
  const windowWidth = useRef(GAME_WINDOW);
  const reduced = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, serverReducedMotion);
  const moving = !still && (colour >= 6 || effect !== 0);
  const drawnEffect = reduced ? 0 : effect;

  useLayoutEffect(() => {
    // A scroll enters at its window's right edge. Put it there before the
    // first paint, so a line drawn afresh (overhead chat's next line) is not
    // seen at the left edge for a frame before its pass begins.
    const frame = scrollWindow.current;
    const slider = frame?.querySelector<HTMLSpanElement>("[data-scroll]");
    if (drawnEffect !== 2 || !frame || !slider) return;
    slider.style.transform = `translateX(${frame.clientWidth || GAME_WINDOW}px)`;
  }, [drawnEffect, text]);

  useEffect(() => {
    const frame = scrollWindow.current;
    if (drawnEffect !== 2 || !frame) return;
    windowWidth.current = frame.clientWidth || GAME_WINDOW;
    onScrollWindow?.(windowWidth.current);
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(([entry]) => {
      windowWidth.current = Math.round(entry.contentRect.width) || GAME_WINDOW;
      onScrollWindow?.(windowWidth.current);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [drawnEffect, onScrollWindow]);

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
    /** The cycle the scroll's pass started on: the first it heard. */
    let start: number | null = null;
    return onCycle((cycle) => {
      element.style.color = cssColour(colourAt(colour, cycle));
      if (effect === 1) {
        for (const [span, i] of chars) span.style.transform = `translateY(${waveOffset(i, cycle)}px)`;
      } else if (effect === 2 && slider) {
        start ??= cycle;
        const wide = windowWidth.current;
        slider.style.transform = `translateX(${wide - scrollOffset(width, cycle - start, wide)}px)`;
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
      <span ref={scrollWindow} data-window style={SCROLL_WINDOW}>
        <span data-scroll style={SCROLL_TEXT}>
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
