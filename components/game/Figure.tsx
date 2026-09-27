"use client";

import { useRef } from "react";

import { nearestFacing } from "@/lib/chathead/facing";
import { figure, loadFigureClips, loadFigures } from "@/lib/chathead/load";
import type { Look } from "@/lib/chathead/look";
import type { Emote } from "@/lib/chathead/vocab";

import { useEmotePlayback } from "./useEmotePlayback";

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
 * frame by frame at the game's pace, then stands again; a new `replay`
 * while it plays starts it over (`useEmotePlayback`, which `<SceneFigure>`
 * shares). Whether anything plays by itself is the caller's decision,
 * reduced motion included: a replay asked for is played.
 *
 * With `facing` (`lib/chathead/facing.ts`) it is turned to that angle,
 * standing and acting alike, in the turn frame: centred on the figure's
 * axis, so turning never moves it, and wide enough for every golden look
 * standing at every angle. An emote with a long weapon - a staff, a spear -
 * can still reach its edge at some angles, as some reach the plain frame's.
 * Without a facing it is the plain figure in its own frame, the picture the
 * golden tests hold.
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
  facing,
  scale = 1,
  label = "Figure",
  className,
}: {
  look: Look | null;
  /** What a `replay` acts out. */
  emote?: Emote | null;
  /** Change it to act out `emote` once. */
  replay?: number;
  /** Turn it to this facing, 0-15, in the turn frame; leave it out for the plain figure. */
  facing?: number;
  scale?: number;
  label?: string;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const turned = facing === undefined ? undefined : nearestFacing(facing);
  const { width, height } = turned === undefined ? figure.frame : figure.turnFrame;

  useEmotePlayback({
    canvas,
    look,
    emote,
    replay,
    source: turned,
    loadStanding: async () => {
      const figures = await loadFigures();
      return (actor) => {
        const image = actor ? figures.draw(actor, turned) : null;
        return image && { image, x: 0, y: 0 };
      };
    },
    loadEmotes: async () => {
      const clips = await loadFigureClips();
      return (actor, act) => clips.emote(actor, act, turned);
    },
    paint,
    errors: {
      standing: "[figure] the renderer failed to load:",
      emotes: "[figure] the emotes failed to load:",
    },
  });

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
