import { type RefObject, useEffect, useEffectEvent, useRef } from "react";

import { frameAt } from "@/lib/chathead/animate";
import type { ImageClip } from "@/lib/chathead/load";
import type { Look } from "@/lib/chathead/look";
import type { Emote } from "@/lib/chathead/vocab";
import { onCycle } from "@/lib/game-chat/clock";

/** A drawing, and where on the canvas it goes. */
export type Placed = { image: ImageData; x: number; y: number };

export type EmotePlayback = {
  canvas: RefObject<HTMLCanvasElement | null>;
  look: Look | null;
  /** What a `replay` acts out. */
  emote: Emote | null;
  /** Change it to act out `emote` once. */
  replay: number | undefined;
  /**
   * What the drawings are drawn from besides the look — a scene's spot, or
   * nothing for the plain figure. A new one redraws the standing figure, as
   * a new look does.
   */
  source?: unknown;
  /** The renderer, loaded: how to draw a look standing (null: nothing to draw). */
  loadStanding(): Promise<(look: Look | null) => Placed | null>;
  /** The renderer with the emotes, loaded: how to draw a look acting one out. */
  loadEmotes(): Promise<(look: Look, emote: Emote) => ImageClip | null>;
  /** Put a drawing, or none, on the canvas at `x`, `y`, over what it stands on. */
  paint(canvas: HTMLCanvasElement | null, image: ImageData | null, x?: number, y?: number): void;
  /** What to log when a load fails: the standing figure's, and the emotes'. */
  errors: { standing: string; emotes: string };
};

/**
 * A figure on a canvas that stands, and acts out an emote on request: the
 * one behaviour `<Figure>` and `<SceneFigure>` share, whatever they draw
 * with and onto.
 *
 * - It draws the look standing once it is loaded, and again for a new look
 *   or `source`; a load that arrives after that, or after unmount, is
 *   dropped.
 * - It acts out `emote` once each time `replay` changes after it mounts —
 *   never for the value it mounted with — frame by frame at the game's pace
 *   (`lib/chathead/animate.ts`, on the page's one clock), then stands
 *   again. A new `replay` while it plays starts it over from the first
 *   frame; unmounting stops it. The look and emote are the ones current
 *   when the replay arrives.
 * - Whether anything plays by itself, reduced motion included, is the
 *   caller's decision: a replay asked for is played.
 */
export function useEmotePlayback({
  canvas,
  look,
  emote,
  replay,
  source,
  loadStanding,
  loadEmotes,
  paint,
  errors,
}: EmotePlayback): void {
  /** The standing figure, to return to after an emote. */
  const standing = useRef<Placed | null>(null);
  const playing = useRef(false);
  /** The last `replay` seen: the one it mounted with, then each played. */
  const played = useRef(replay);

  const paintStanding = () => {
    const still = standing.current;
    paint(canvas.current, still?.image ?? null, still?.x, still?.y);
  };

  /** Load and draw the look standing; `current` says whether it is still wanted. */
  const stand = useEffectEvent((current: () => boolean) => {
    loadStanding()
      .then((draw) => {
        if (!current()) return;
        standing.current = draw(look);
        if (!playing.current) paintStanding();
      })
      .catch((error) => {
        console.error(errors.standing, error);
      });
  });

  useEffect(() => {
    let current = true;
    stand(() => current);
    return () => {
      current = false;
    };
  }, [look, source]);

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
      paintStanding();
    };

    if (!look || !emote) {
      end();
      return halt;
    }
    const [actor, act] = [look, emote];
    loadEmotes()
      .then((emotes) => {
        if (!current) return;
        const clip = emotes(actor, act);
        if (!clip) return end();
        playing.current = true;
        let start: number | null = null;
        let shown = -1;
        stop = onCycle((cycle) => {
          start ??= cycle;
          const index = frameAt(clip, cycle - start);
          if (index === null) return end();
          if (index === shown) return;
          shown = index;
          paint(canvas.current, clip.frames[index], clip.x, clip.y);
        });
      })
      .catch((error) => {
        console.error(errors.emotes, error);
      });
    return halt;
  });

  useEffect(() => {
    if (replay === played.current) return;
    played.current = replay;
    return play();
  }, [replay]);
}
