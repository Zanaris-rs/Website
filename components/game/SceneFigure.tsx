"use client";

import { useRef } from "react";

import { loadScene, loadSceneClips, type Scene } from "@/lib/chathead/load";
import type { Look } from "@/lib/chathead/look";
import type { Emote } from "@/lib/chathead/vocab";
import { type SceneSpot, sceneSrc } from "@/lib/scenes/spots";

import { useEmotePlayback } from "./useEmotePlayback";

type Props = {
  spot: SceneSpot;
  look: Look | null;
  /** What a `replay` acts out. */
  emote?: Emote | null;
  /** Change it to act out `emote` once. */
  replay?: number;
  label?: string;
  className?: string;
  /**
   * Heard once if the scene cannot be drawn - its backdrop failed: a 404,
   * or a browser with no `DecompressionStream` (Safari before 16.4, Firefox
   * before 113). The caller draws the plain `<Figure>` instead.
   */
  onFail?: () => void;
};

/**
 * A player's figure standing in a pre-rendered scene: the spot's backdrop,
 * with the figure drawn into it by the game client's own renderer from the
 * spot's eye (`lib/scenes/draw.ts`), as the game's `World` draws a player
 * on a tile. The build proved, for every spot, that this is the game's own
 * picture of the scene with the figure in it (`scripts/scenes/render.ts`).
 *
 * As `<Figure>`, and through the same `useEmotePlayback`: only for a saved
 * outfit; it acts out `emote` once each time `replay` changes after it
 * mounts, frame by frame at the game's pace, then stands again, and a new
 * `replay` while it plays starts it over; whether anything plays by itself,
 * reduced motion included, is the caller's decision.
 *
 * The canvas is the scene's size from the first paint, with the backdrop
 * behind it as a plain picture, so the scene is there before the renderer
 * is; once the figure is drawn, the canvas covers it with the same pixels.
 * A new spot is a new scene: nothing drawn for the last one carries over.
 * If the scene fails, `onFail` says so, for the plain figure to stand in.
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

/** A failed scene is logged once a page, however many spots fail after it. */
let failureLogged = false;

function SceneCanvas({ spot, look, emote = null, replay, label = "Figure", className, onFail }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const backdrop = useRef<ImageData | null>(null);
  /** The scene the standing figure is drawn in, or null if it failed. */
  const loaded = useRef<Promise<Scene | null> | null>(null);

  useEmotePlayback({
    canvas,
    look,
    emote,
    replay,
    source: spot,
    loadStanding: async () => {
      // A failure is answered here, not thrown: the caller swaps in the
      // plain figure, and one line in the console says why.
      const loading = loadScene(spot).catch((error: unknown) => {
        if (!failureLogged) {
          failureLogged = true;
          console.warn("[scene] the scene failed to load; drawing the plain figure:", error);
        }
        onFail?.();
        return null;
      });
      loaded.current = loading;
      const scene = await loading;
      if (!scene) return () => null;
      return (actor) => {
        backdrop.current = scene.backdrop;
        const still = actor ? scene.stand(actor) : null;
        return still && { image: still.frames[0], x: still.x, y: still.y };
      };
    },
    loadEmotes: async () => {
      const loading = loadSceneClips(spot);
      // A scene that failed is the standing figure's to report: no emotes.
      if (loaded.current && !(await loaded.current)) {
        loading.catch(() => {});
        return () => null;
      }
      const clips = await loading;
      return (actor, act) => {
        const clip = clips.emote(actor, act);
        if (clip) backdrop.current ??= clips.backdrop;
        return clip;
      };
    },
    paint: (target, image, x, y) => paint(target, backdrop.current, image, x, y),
    errors: {
      standing: "[scene] the scene failed to load:",
      emotes: "[scene] the emotes failed to load:",
    },
  });

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
