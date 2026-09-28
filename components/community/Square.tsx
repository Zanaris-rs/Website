"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import ChatText from "@/components/game/ChatText";
import { logHref } from "@/lib/adventurer-log/href";
import { lineAt } from "@/lib/adventurer-log/overhead";
import { loadClanPhoto } from "@/lib/chathead/load";
import { type Look, lookKey } from "@/lib/chathead/look";
import { chatLeft, mouseOver, speakers, type SquareSitter, squareSpot } from "@/lib/community/square";
import { onCycle, prefersReducedMotion, subscribeReducedMotion } from "@/lib/game-chat/clock";
import { stringWidth } from "@/lib/game-chat/metrics";
import { centreOut, farToNear, photoSlots, type PlacedSitter } from "@/lib/scenes/photo";
import { sceneSrc } from "@/lib/scenes/spots";

import styles from "./Community.module.css";

const SPOT = squareSpot();

/** Off on the server and in the first render, so hydration matches. */
const serverReducedMotion = () => false;

/**
 * `looks`, kept as the same array for as long as every look in it is the
 * same (`lookKey`), whatever objects the page hands over: the square is
 * drawn once per row of looks, not once per render.
 */
function useSteadyLooks(looks: Look[]): readonly Look[] {
  const key = looks.map(lookKey).join(" ");
  const [kept, setKept] = useState({ key, looks });
  if (kept.key !== key) setKept({ key, looks });
  return kept.key === key ? kept.looks : looks;
}

/**
 * The square: Varrock square with the adventurers most recently about
 * standing in it in their saved outfits, the most recent in the middle and
 * the rest out to either side, drawn once by the clan photo's drawer
 * (`loadClanPhoto`) and shown at 1.5x, pixel for pixel, from 600px up.
 *
 * Over the picture, in its own 240x300 pixels and scaled with it:
 * - **What they say:** each one's greeting over their head, as the game
 *   hangs overhead chat, in its colour and effect. One speaks at a time,
 *   most recent first, then outward, each for 150 cycles or one scroll pass
 *   across the frame, round and round on the game's clock. Under reduced
 *   motion only the first speaker's line shows, still.
 * - **Pointing at one:** each is a real link over the box their body was
 *   drawn in, named "<name>'s Adventurer Log". Hovering or focusing it shows
 *   the game's mouse-over at the top left: "View log <name>", and their
 *   level in green when it is exact. Where two boxes overlap, the figure
 *   drawn in front owns the overlap.
 *
 * The backdrop is the canvas's background from the first paint. Nothing is
 * laid over it until the figures are drawn, since only then is it known
 * where they stand; if drawing fails, the scene stays alone and the console
 * says why. With nobody about, the renderer is never fetched.
 */
export default function Square({
  sitters,
  unavailable = false,
}: {
  /** Most recent first, at most five, each with a saved outfit (`loadSquare`). */
  sitters: readonly SquareSitter[];
  /** The hub could not read who is about. */
  unavailable?: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  /** The last drawing, and the looks it was drawn from. */
  const [picture, setPicture] = useState<{ looks: readonly Look[]; placed: PlacedSitter[] } | null>(null);
  const [speaking, setSpeaking] = useState(0);
  /** The sitter being pointed at, by their place in `sitters`. */
  const [pointed, setPointed] = useState<number | null>(null);
  const reduced = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, serverReducedMotion);

  /**
   * Where each sitter stands, left to right, as their place in `sitters`:
   * the i-th most recent at `centreOutSlot(i, n)`, where `speakers` puts
   * their turn, so `placed[turn.position]` is the speaker's own figure.
   */
  const order = useMemo(() => centreOut(sitters.map((_, i) => i)), [sitters]);
  const looks = useSteadyLooks(order.map((i) => sitters[i].look));
  const turns = useMemo(() => speakers(sitters, SPOT.width), [sitters]);
  /** Each position's place in the drawing, far to near (`drawPlacedPhoto`'s own order). */
  const drawn = useMemo(() => {
    const at = new Array<number>(order.length);
    farToNear(SPOT, photoSlots(SPOT, order.length)).forEach((position, k) => {
      at[position] = k;
    });
    return at;
  }, [order.length]);

  useEffect(() => {
    if (looks.length === 0) return;
    let current = true;
    loadClanPhoto(SPOT)
      .then((photo) => {
        if (!current) return;
        const { image, placed } = photo.draw(looks);
        canvas.current?.getContext("2d")?.putImageData(image, 0, 0);
        setPicture({ looks, placed });
      })
      .catch((error: unknown) => {
        if (current) console.error("[community] the square could not be drawn; showing the scene alone:", error);
      });
    return () => {
      current = false;
    };
  }, [looks]);

  /** Where everyone stands in the picture on the canvas, once it is drawn. */
  const placed = picture?.looks === looks ? picture.placed : null;

  // Whose turn it is, on the game's clock. `lineAt` walks a page's lines;
  // here the lines are the speakers, keyed by their turn, so two alike
  // greetings keep their own lengths.
  useEffect(() => {
    if (reduced || !placed || turns.length < 2) return;
    const keys = turns.map((_, i) => String(i));
    let start: number | null = null;
    let shown = -1;
    return onCycle((cycle) => {
      start ??= cycle;
      const { index } = lineAt(keys, cycle - start, (key) => turns[Number(key)].cycles);
      if (index !== shown) {
        shown = index;
        setSpeaking(index);
      }
    });
  }, [reduced, placed, turns]);

  const turn = turns.length === 0 ? null : turns[reduced ? 0 : speaking % turns.length];
  const head = turn && placed ? placed[turn.position].head : null;
  const chatEffect = reduced || !turn ? 0 : turn.effect;
  const over = pointed === null ? null : mouseOver(sitters[pointed]);

  const names = order.map((i) => sitters[i].name);
  const caption = unavailable
    ? "The square is unavailable right now. Try again shortly."
    : sitters.length === 0
      ? "Nobody’s about yet."
      : `${SPOT.name} · the adventurers most recently about. Click one to read their log.`;

  return (
    <figure className={styles.square}>
      <div className={styles.frame}>
        <canvas
          ref={canvas}
          className={styles.canvas}
          width={SPOT.width}
          height={SPOT.height}
          role="img"
          aria-label={names.length > 0 ? `${SPOT.name}: ${names.join(", ")}` : SPOT.name}
          style={{ backgroundImage: `url(${sceneSrc(SPOT)})` }}
        />
        {placed ? (
          <div className={styles.overlay}>
            {turn && head ? (
              <div
                className={styles.chat}
                style={{
                  left: chatLeft(head.x, stringWidth(turn.text, "b12"), chatEffect, SPOT.width),
                  bottom: SPOT.height - head.y,
                  width: SPOT.width,
                }}
              >
                {/* A new speaker is a new line: a scroll starts its pass as it appears. */}
                <ChatText key={turn.position} text={turn.text} colour={turn.colour} effect={turn.effect} />
              </div>
            ) : null}
            {over ? (
              <p className={styles.mouseOver} aria-hidden="true">
                {over.text}
                {over.level ? <span className={styles.level}>{over.level}</span> : null}
              </p>
            ) : null}
            {order.map((i, position) => {
              const { box } = placed[position];
              if (box.w === 0 || box.h === 0) return null;
              const sitter = sitters[i];
              return (
                <a
                  key={sitter.username}
                  className={styles.sitter}
                  href={logHref(sitter.username)}
                  aria-label={`${sitter.name}'s Adventurer Log`}
                  // Neighbours' boxes can overlap by several pixels (7–9 px
                  // measured): each link stacks as its figure was drawn, far
                  // to near, so the one in front owns the overlap. All stay
                  // under the chat.
                  style={{ left: box.x, top: box.y, width: box.w, height: box.h, zIndex: drawn[position] }}
                  onMouseEnter={() => setPointed(i)}
                  onMouseLeave={() => setPointed(null)}
                  onFocus={() => setPointed(i)}
                  onBlur={() => setPointed(null)}
                />
              );
            })}
          </div>
        ) : null}
      </div>
      <figcaption className={styles.caption}>{caption}</figcaption>
    </figure>
  );
}
