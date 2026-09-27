"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import type { DialoguePage } from "@/lib/adventurer-log/persona";
import { nearestFacing } from "@/lib/chathead/facing";
import type { Look } from "@/lib/chathead/look";
import type { Emote } from "@/lib/chathead/vocab";
import { prefersReducedMotion } from "@/lib/game-chat/clock";

export type Stage = {
  /**
   * The page now shown, already clamped to `pages`: never out of range even
   * if `pages` shrinks while this state is kept (as with the Words tab's
   * live stage, which re-renders with fewer pages under the same state when
   * a page is removed). Readers use this directly and never reclamp it
   * themselves.
   */
  page: number;
  pageCount: number;
  next(): void;
  /**
   * Make `page` the current page and play its emote - the Words tab's rows,
   * when one is chosen, typed in or played. With `{ play: false }` it only
   * follows the page, without playing it: the Words tab keeps the stage on
   * the page it was showing when a page is moved or removed. Not clamped
   * here: `page` above is clamped on read, so a row added in the same update
   * (one past today's last) is shown once it exists.
   */
  goTo(page: number, options?: { play?: boolean }): void;
  /**
   * The emote the figure acts out now: the current page's own emote, or -
   * only when there is no current page at all - the signature one. A page
   * that explicitly has no emote (`emote: null`) leaves the figure still;
   * it does not fall back to the signature emote.
   */
  emote: Emote | null;
  /** Bumped to make the figure play `emote` once. */
  replay: number;
  replayEmote(): void;
  /**
   * The way the figure faces (`lib/chathead/facing.ts`; 0 faces you),
   * already one of `turns` when the stage has them, as `page` is already
   * clamped. Readers draw it as it is.
   */
  facing: number;
  /** Face `f`, or the nearest facing `turns` allows. A figure turned by hand steps through `useTurnGesture`. */
  setFacing(f: number): void;
  /**
   * An outfit a reader is trying on from the Wardrobe: the card's figure and
   * the dialogue's chathead wear it in place of the usual look until it is
   * set back to null. Never saved: what the owner wears is changed on their
   * Character page. It is one of the Wardrobe's own look objects, so the
   * drawings kept per look stay put.
   */
  tryOn: Look | null;
  setTryOn(look: Look | null): void;
};

/** No arrival played yet: not any `resetKey`, `undefined` included. */
const NOT_YET = Symbol("not yet");

const StageContext = createContext<Stage>({
  page: 0, pageCount: 0, next() {}, goTo() {}, emote: null, replay: 0, replayEmote() {},
  facing: 0, setFacing() {}, tryOn: null, setTryOn() {},
});

/**
 * The card's figure and the dialogue box share one conversation: continuing
 * the dialogue plays the next page's emote on the figure. They sit in
 * different columns, so the log page wraps both in this. The first emote
 * plays once on arrival, unless the reader prefers reduced motion.
 *
 * It also holds the way the figure faces: the owner's facing when the page
 * opens, then wherever a reader turns it. Turning only ever happens when
 * asked, so reduced motion changes nothing about it.
 *
 * And an outfit a reader tries on from the Wardrobe (`tryOn`), which the
 * card and the dialogue box both wear.
 *
 * `resetKey` starts the stage afresh when it changes - the first page, its
 * emote played as on arrival, and `initialFacing` - without remounting
 * anything inside it, so a Character tab's own controls keep their focus and
 * its live regions stay the same ones.
 */
export default function PersonaStage({
  pages,
  signatureEmote,
  initialFacing = 0,
  turns = null,
  resetKey,
  children,
}: {
  pages: readonly DialoguePage[];
  /**
   * The fallback emote for when there is no current page - the caller
   * passes `null` whenever the owner has written real pages of their own,
   * even if one of them has no emote: that page's stillness must not be
   * covered up by falling back to the signature emote.
   */
  signatureEmote: Emote | null;
  /** The way the figure faces when the page opens: the persona's `facing`. */
  initialFacing?: number;
  /** The facings the figure may turn to, in order (its scene's `turns`), or null for all sixteen. */
  turns?: readonly number[] | null;
  /** A change starts the conversation and the turn afresh (the Look tab: a scene). */
  resetKey?: string | number;
  children: ReactNode;
}) {
  const [pageState, setPageState] = useState(0);
  const [replay, setReplay] = useState(0);
  const [facingState, setFacingState] = useState(initialFacing);
  const [tryOn, setTryOnState] = useState<Look | null>(null);
  const [shownKey, setShownKey] = useState(resetKey);
  // The key whose arrival emote has been asked for, so that asking twice for
  // one arrival (Strict Mode runs the effect twice) plays it once.
  const arrived = useRef<string | number | undefined | typeof NOT_YET>(NOT_YET);
  if (resetKey !== shownKey) {
    // React's "adjust state when a prop changes": set while rendering, so
    // nothing draws the old page or facing first, and nothing remounts.
    setShownKey(resetKey);
    setPageState(0);
    setFacingState(nearestFacing(initialFacing, turns));
  }
  // Clamped once, here, rather than by each reader: `pages` can shrink under
  // an unchanged `pageState` (the Words tab's live stage, when a page is
  // removed), and `goTo` stores the page asked for as it is - a page added in
  // the same update is one past the last until then - so an out-of-range
  // page would print wrong wherever it was read raw (e.g. "5 / 3").
  const page = pages.length === 0 ? 0 : Math.min(pageState, pages.length - 1);
  const currentPage = pages.length > 0 ? pages[page] : undefined;
  const emote = currentPage?.emote ?? signatureEmote;
  // Held to `turns` here, once, for the same reason: a scene draws only the
  // facings it proved, and `turns` can change under an unchanged state (the
  // editor's scene picker).
  const facing = nearestFacing(facingState, turns);

  useEffect(() => {
    // Deferred rather than called straight from the effect body: `Figure`
    // decides whether to play by comparing `replay` to the value it mounted
    // with, so this has to be a genuine change *after* mount, not the
    // initial render's state - queueing it keeps that same one-tick-later
    // change while satisfying the lint rule against a synchronous setState
    // in an effect. Again after each reset (`shownKey`): a figure a reset
    // brings (a new scene's) mounts with the replay it finds, so the bump
    // comes after it, as on arrival.
    if (arrived.current === shownKey) return;
    arrived.current = shownKey;
    if (prefersReducedMotion()) return;
    queueMicrotask(() => setReplay((count) => count + 1));
  }, [shownKey]);

  const next = useCallback(() => {
    if (pages.length === 0) return;
    setPageState((page + 1) % pages.length);
    setReplay((count) => count + 1);
  }, [pages.length, page]);
  const goTo = useCallback((to: number, { play = true }: { play?: boolean } = {}) => {
    setPageState(Math.max(0, to));
    if (play) setReplay((count) => count + 1);
  }, []);
  const replayEmote = useCallback(() => setReplay((count) => count + 1), []);
  const setFacing = useCallback((f: number) => setFacingState(nearestFacing(f, turns)), [turns]);
  const setTryOn = useCallback((look: Look | null) => setTryOnState(look), []);

  const value = useMemo(
    () => ({ page, pageCount: pages.length, next, goTo, emote, replay, replayEmote, facing, setFacing, tryOn, setTryOn }),
    [page, pages.length, next, goTo, emote, replay, replayEmote, facing, setFacing, tryOn, setTryOn],
  );
  return <StageContext.Provider value={value}>{children}</StageContext.Provider>;
}

export function usePersonaStage(): Stage {
  return useContext(StageContext);
}
