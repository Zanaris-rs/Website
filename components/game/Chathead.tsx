"use client";

import { useEffect, useRef } from "react";

import { frameAt } from "@/lib/chathead/animate";
import { loadChatheadClips, loadChatheads, tables } from "@/lib/chathead/load";
import type { Look } from "@/lib/chathead/look";
import type { Mood } from "@/lib/chathead/vocab";
import { onCycle, prefersReducedMotion } from "@/lib/game-chat/clock";

/** Put a drawing on the canvas at `x`, `y`, over nothing. */
function paint(canvas: HTMLCanvasElement | null, image: ImageData | null, x = 0, y = 0) {
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (image) context.putImageData(image, x, y);
}

/**
 * A player's chathead: their head as a quest dialogue shows it, drawn in the
 * browser by the game client's own renderer (`lib/chathead/`).
 *
 * With a `mood` it talks, as the dialogue's head does in game, for a page
 * of `lines` lines (1 to 4 pick the mood's four lengths): the head talks
 * once, then keeps up the mood's last few frames for as long as it is shown
 * (`lib/chathead/animate.ts`). With reduced motion it holds the mood's first
 * frame. With no mood it is the still head.
 *
 * The canvas is the frame's size from the first paint, so nothing shifts
 * when the head arrives a moment later. `scale` enlarges it with square
 * pixels; whole numbers keep every pixel the same size. A look with no head
 * leaves the frame empty.
 */
export default function Chathead({
  look,
  mood = null,
  lines = 1,
  scale = 1,
  label = "Chathead",
  className,
}: {
  look: Look | null;
  /** The mood it talks in; none for the still head. */
  mood?: Mood | null;
  /** The page's line count, which picks how long the mood talks. */
  lines?: number;
  scale?: number;
  label?: string;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { width, height } = tables.frame;

  useEffect(() => {
    let current = true;
    let stop: (() => void) | null = null;
    const element = canvas.current;

    if (!mood) {
      loadChatheads()
        .then((chatheads) => {
          if (current) paint(element, look ? chatheads.draw(look) : null);
        })
        .catch((error) => {
          console.error("[chathead] the renderer failed to load:", error);
        });
    } else {
      loadChatheadClips()
        .then((clips) => {
          if (!current) return;
          const clip = look ? clips.mood(look, mood, lines) : null;
          if (!clip) return paint(element, null);
          paint(element, clip.frames[0], clip.x, clip.y);
          if (prefersReducedMotion()) return;

          let start: number | null = null;
          let shown = 0;
          stop = onCycle((cycle) => {
            start ??= cycle;
            // A mood always loops, so there is always a frame.
            const index = frameAt(clip, cycle - start) ?? 0;
            if (index === shown) return;
            shown = index;
            paint(element, clip.frames[index], clip.x, clip.y);
          });
        })
        .catch((error) => {
          console.error("[chathead] the moods failed to load:", error);
        });
    }
    return () => {
      current = false;
      stop?.();
    };
  }, [look, mood, lines]);

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
