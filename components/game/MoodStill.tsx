"use client";

import { useEffect, useRef } from "react";

import { loadMoodStill, tables } from "@/lib/chathead/load";
import type { Look } from "@/lib/chathead/look";
import type { Mood } from "@/lib/chathead/vocab";

/** Put a drawing on the canvas, over nothing. */
function paint(canvas: HTMLCanvasElement | null, image: ImageData | null) {
  const context = canvas?.getContext("2d");
  if (!canvas || !context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (image) context.putImageData(image, 0, 0);
}

/**
 * One still of a chathead in a mood (`loadMoodStill`): the Words tab's rows
 * that are not being played, and the mood picker's fourteen choices.
 * `<Chathead mood>` is the one that talks. The canvas is the chathead frame
 * from the first paint; with no `label` it is hidden from screen readers.
 */
export default function MoodStill({
  look,
  mood,
  scale = 1,
  label,
  className,
}: {
  look: Look;
  mood: Mood;
  scale?: number;
  label?: string;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { width, height } = tables.frame;

  useEffect(() => {
    let current = true;
    const element = canvas.current;
    loadMoodStill(look, mood)
      .then((image) => {
        if (current) paint(element, image);
      })
      .catch((error) => {
        console.error("[chathead] a still failed to draw:", error);
      });
    return () => {
      current = false;
    };
  }, [look, mood]);

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
