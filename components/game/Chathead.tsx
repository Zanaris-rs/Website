"use client";

import { useEffect, useRef } from "react";

import { loadChatheads, tables } from "@/lib/chathead/load";
import type { Look } from "@/lib/chathead/look";

/**
 * A player's chathead: their head as a quest dialogue shows it, drawn in the
 * browser by the game client's own renderer (`lib/chathead/`).
 *
 * The canvas is the frame's size from the first paint, so nothing shifts
 * when the head arrives a moment later. `scale` enlarges it with square
 * pixels; whole numbers keep every pixel the same size. A look with no head
 * leaves the frame empty.
 */
export default function Chathead({
  look,
  scale = 1,
  label = "Chathead",
  className,
}: {
  look: Look | null;
  scale?: number;
  label?: string;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { width, height } = tables.frame;

  useEffect(() => {
    let current = true;
    loadChatheads()
      .then((chatheads) => {
        const context = canvas.current?.getContext("2d");
        if (!current || !context) return;
        context.clearRect(0, 0, width, height);
        const image = look ? chatheads.draw(look) : null;
        if (image) context.putImageData(image, 0, 0);
      })
      .catch((error) => {
        console.error("[chathead] the renderer failed to load:", error);
      });
    return () => {
      current = false;
    };
  }, [look, width, height]);

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
