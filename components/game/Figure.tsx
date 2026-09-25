"use client";

import { useEffect, useRef } from "react";

import { figure, loadFigures } from "@/lib/chathead/load";
import type { Look } from "@/lib/chathead/look";

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
 * As `<Chathead>`: the canvas is the frame's size from the first paint, so
 * nothing shifts when the figure arrives a moment later; `scale` enlarges it
 * with square pixels, and whole numbers keep every pixel the same size; a
 * look with nothing to draw leaves the frame empty.
 */
export default function Figure({
  look,
  scale = 1,
  label = "Figure",
  className,
}: {
  look: Look | null;
  scale?: number;
  label?: string;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const { width, height } = figure.frame;

  useEffect(() => {
    let current = true;
    loadFigures()
      .then((figures) => {
        const context = canvas.current?.getContext("2d");
        if (!current || !context) return;
        context.clearRect(0, 0, width, height);
        const image = look ? figures.draw(look) : null;
        if (image) context.putImageData(image, 0, 0);
      })
      .catch((error) => {
        console.error("[figure] the renderer failed to load:", error);
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
