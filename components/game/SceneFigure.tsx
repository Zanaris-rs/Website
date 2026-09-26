"use client";

import { useEffect, useEffectEvent, useRef } from "react";

import { frameAt } from "@/lib/chathead/animate";
import { type ImageClip, loadScene, loadSceneClips } from "@/lib/chathead/load";
import type { Look } from "@/lib/chathead/look";
import type { Emote } from "@/lib/chathead/vocab";
import { onCycle } from "@/lib/game-chat/clock";
import { type SceneSpot, sceneSrc } from "@/lib/scenes/spots";

type Props = {
  spot: SceneSpot;
  look: Look | null;
  /** What a `replay` acts out. */
  emote?: Emote | null;
  /** Change it to act out `emote` once. */
  replay?: number;
  label?: string;
  className?: string;
};

/**
 * A player's figure standing in a pre-rendered scene: the spot's backdrop,
 * with the figure drawn into it by the game client's own renderer from the
 * spot's eye (`lib/scenes/draw.ts`), as the game's `World` draws a player
 * on a tile. The build proved, for every spot, that this is the game's own
 * picture of the scene with the figure in it (`scripts/scenes/render.ts`).
 *
 * As `<Figure>`: only for a saved outfit; it acts out `emote` once each
 * time `replay` changes after it mounts, frame by frame at the game's pace,
 * then stands again, and a new `replay` while it plays starts it over;
 * whether anything plays by itself, reduced motion included, is the
 * caller's decision.
 *
 * The canvas is the scene's size from the first paint, with the backdrop
 * behind it as a plain picture, so the scene is there before the renderer
 * is; once the figure is drawn, the canvas covers it with the same pixels.
 * A new spot is a new scene: nothing drawn for the last one carries over.
 */
export default function SceneFigure(props: Props) {
  return <SceneCanvas key={props.spot.key} {...props} />;
}

/** Put the backdrop, then a figure frame at `x`, `y`, on the canvas. */
function paint(
  canvas: HTMLCanvasElement | null,
  backdrop: ImageData | null,
  image: ImageData | null,
  x = 0,
  y = 0,
) {
  const context = canvas?.getContext("2d");
  if (!canvas || !context || !backdrop) return;
  context.putImageData(backdrop, 0, 0);
  if (image) context.putImageData(image, x, y);
}

/** Paint the figure standing, or the backdrop alone for a look with no body. */
function paintStanding(
  canvas: HTMLCanvasElement | null,
  backdrop: ImageData | null,
  standing: ImageClip | null,
) {
  paint(canvas, backdrop, standing?.frames[0] ?? null, standing?.x, standing?.y);
}

function SceneCanvas({ spot, look, emote = null, replay, label = "Figure", className }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const backdrop = useRef<ImageData | null>(null);
  /** The standing figure, to return to after an emote. */
  const standing = useRef<ImageClip | null>(null);
  const playing = useRef(false);
  /** The last `replay` seen: the one it mounted with, then each played. */
  const played = useRef(replay);

  useEffect(() => {
    let current = true;
    loadScene(spot)
      .then((scene) => {
        if (!current) return;
        backdrop.current = scene.backdrop;
        standing.current = look ? scene.stand(look) : null;
        if (!playing.current) paintStanding(canvas.current, backdrop.current, standing.current);
      })
      .catch((error) => {
        console.error("[scene] the scene failed to load:", error);
      });
    return () => {
      current = false;
    };
  }, [look, spot]);

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
    const end = () => {
      halt();
      paintStanding(canvas.current, backdrop.current, standing.current);
    };

    if (!look || !emote) {
      end();
      return halt;
    }
    const [actor, act] = [look, emote];
    loadSceneClips(spot)
      .then((clips) => {
        if (!current) return;
        const clip = clips.emote(actor, act);
        if (!clip) return end();
        backdrop.current ??= clips.backdrop;
        playing.current = true;
        let start: number | null = null;
        let shown = -1;
        stop = onCycle((cycle) => {
          start ??= cycle;
          const index = frameAt(clip, cycle - start);
          if (index === null) return end();
          if (index === shown) return;
          shown = index;
          paint(canvas.current, backdrop.current, clip.frames[index], clip.x, clip.y);
        });
      })
      .catch((error) => {
        console.error("[scene] the emotes failed to load:", error);
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
      width={spot.width}
      height={spot.height}
      role="img"
      aria-label={label}
      style={{
        width: spot.width,
        height: spot.height,
        imageRendering: "pixelated",
        backgroundImage: `url(${sceneSrc(spot)})`,
      }}
    />
  );
}
