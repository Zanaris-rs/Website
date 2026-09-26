"use client";

import { useEffect, useEffectEvent, useRef } from "react";

import { frameAt } from "@/lib/chathead/animate";
import { figure, loadFigureClips, loadFigures } from "@/lib/chathead/load";
import type { Look } from "@/lib/chathead/look";
import type { Emote } from "@/lib/chathead/vocab";
import { onCycle } from "@/lib/game-chat/clock";

/** Put a drawing on the canvas at `x`, `y`, over nothing. */
function paint(canvas: HTMLCanvasElement | null, image: ImageData | null, x = 0, y = 0) {
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (image) context.putImageData(image, x, y);
}

/**
 * A player's figure: their whole body, standing as the world shows them in
 * what the look wears, drawn in the browser by the game client's own
 * renderer (`lib/chathead/body.ts`), at the character design screen's
 * camera.
 *
 * Only for a look its player chose to show — a saved outfit. A look from the
 * game is cut down to its chathead before it leaves the server (`headOnly`,
 * `lib/outfits/looks.ts`), so that a page does not publish what the player
 * wears in game, and must never be drawn whole.
 *
 * It acts out `emote` once each time `replay` changes after it mounts,
 * frame by frame at the game's pace (`lib/chathead/animate.ts`), then stands
 * again; a new `replay` while it plays starts it over. Whether anything
 * plays by itself is the caller's decision, reduced motion included: a
 * replay asked for is played.
 *
 * As `<Chathead>`: the canvas is the frame's size from the first paint, so
 * nothing shifts when the figure arrives a moment later; `scale` enlarges it
 * with square pixels, and whole numbers keep every pixel the same size; a
 * look with nothing to draw leaves the frame empty.
 */
export default function Figure({
  look,
  emote = null,
  replay,
  scale = 1,
  label = "Figure",
  className,
}: {
  look: Look | null;
  /** What a `replay` acts out. */
  emote?: Emote | null;
  /** Change it to act out `emote` once. */
  replay?: number;
  scale?: number;
  label?: string;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  /** The standing figure, to return to after an emote. */
  const standing = useRef<ImageData | null>(null);
  const playing = useRef(false);
  /** The last `replay` seen: the one it mounted with, then each played. */
  const played = useRef(replay);
  const { width, height } = figure.frame;

  useEffect(() => {
    let current = true;
    loadFigures()
      .then((figures) => {
        if (!current) return;
        standing.current = look ? figures.draw(look) : null;
        if (!playing.current) paint(canvas.current, standing.current);
      })
      .catch((error) => {
        console.error("[figure] the renderer failed to load:", error);
      });
    return () => {
      current = false;
    };
  }, [look]);

  /** Act out the emote from its first frame; returns how to stop. */
  const play = useEffectEvent(() => {
    let current = true;
    let stop: (() => void) | null = null;
    const halt = () => {
      current = false;
      stop?.();
      stop = null;
      playing.current = false;
    };
    const stand = () => {
      halt();
      paint(canvas.current, standing.current);
    };

    if (!look || !emote) {
      stand();
      return halt;
    }
    const [actor, act] = [look, emote];
    loadFigureClips()
      .then((clips) => {
        if (!current) return;
        const clip = clips.emote(actor, act);
        if (!clip) return stand();
        playing.current = true;
        let start: number | null = null;
        let shown = -1;
        stop = onCycle((cycle) => {
          start ??= cycle;
          const index = frameAt(clip, cycle - start);
          if (index === null) return stand();
          if (index === shown) return;
          shown = index;
          paint(canvas.current, clip.frames[index], clip.x, clip.y);
        });
      })
      .catch((error) => {
        console.error("[figure] the emotes failed to load:", error);
      });
    return halt;
  });

  useEffect(() => {
    if (replay === played.current) return;
    played.current = replay;
    return play();
  }, [replay]);

  return (
    <canvas
      ref={canvas}
      className={className}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      style={{
        width: width * scale,
        height: height * scale,
        imageRendering: "pixelated",
      }}
    />
  );
}
