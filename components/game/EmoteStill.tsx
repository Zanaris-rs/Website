"use client";

import { useEffect, useRef } from "react";

import { figure, loadEmoteStill } from "@/lib/chathead/load";
import type { Look } from "@/lib/chathead/look";
import type { Emote } from "@/lib/chathead/vocab";

/** Put a drawing on the canvas, over nothing. */
function paint(canvas: HTMLCanvasElement | null, image: ImageData | null) {
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (image) context.putImageData(image, 0, 0);
}

/**
 * One still of a saved outfit acting out an emote: the emote's middle frame,
 * its most telling (`loadEmoteStill`). No emote is the outfit standing. For
 * pickers and lists, where a dozen moving figures would be noise:
 * `<Figure>` is the one that moves.
 *
 * As `<Figure>`: only for a saved outfit; the canvas is the figure frame
 * from the first paint (the turn frame with a `facing`), so nothing shifts
 * when the drawing arrives; `scale` sizes it with square pixels. With no
 * `label` it is decoration, hidden from screen readers: its choice names it.
 */
export default function EmoteStill({
  look,
  emote,
  facing,
  scale = 1,
  label,
  className,
}: {
  look: Look;
  emote: Emote | null;
  facing?: number;
  scale?: number;
  label?: string;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { width, height } = facing === undefined ? figure.frame : figure.turnFrame;

  useEffect(() => {
    let current = true;
    const element = canvas.current;
    loadEmoteStill(look, emote, facing)
      .then((image) => {
        if (current) paint(element, image);
      })
      .catch((error) => {
        console.error("[figure] a still failed to draw:", error);
      });
    return () => {
      current = false;
    };
  }, [look, emote, facing]);

  return (
    <canvas
      ref={canvas}
      className={className}
      width={width}
      height={height}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
      style={{ width: width * scale, height: height * scale, imageRendering: "pixelated" }}
    />
  );
}
