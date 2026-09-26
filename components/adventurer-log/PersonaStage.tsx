"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { DialoguePage } from "@/lib/adventurer-log/persona";
import type { Emote } from "@/lib/chathead/vocab";
import { prefersReducedMotion } from "@/lib/game-chat/clock";

type Stage = {
  /**
   * The page now shown, already clamped to `pages`: never out of range even
   * if `pages` shrinks while this state is kept (as with W5's live editor
   * preview, which re-renders with fewer pages under the same state).
   * Readers use this directly and never reclamp it themselves.
   */
  page: number;
  pageCount: number;
  next(): void;
  /** Back a page, to the last from the first; the editor preview's arrow. */
  prev(): void;
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
};

const StageContext = createContext<Stage>({
  page: 0, pageCount: 0, next() {}, prev() {}, emote: null, replay: 0, replayEmote() {},
});

/**
 * The card's figure and the dialogue box share one conversation: continuing
 * the dialogue plays the next page's emote on the figure. They sit in
 * different columns, so the log page wraps both in this. The first emote
 * plays once on arrival, unless the reader prefers reduced motion.
 */
export default function PersonaStage({
  pages,
  signatureEmote,
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
  children: ReactNode;
}) {
  const [pageState, setPageState] = useState(0);
  const [replay, setReplay] = useState(0);
  // Clamped once, here, rather than by each reader: `pages` can shrink under
  // an unchanged `pageState` (W5's live editor preview), and an out-of-range
  // page would print wrong wherever it was read raw (e.g. "5 / 3").
  const page = pages.length === 0 ? 0 : Math.min(pageState, pages.length - 1);
  const currentPage = pages.length > 0 ? pages[page] : undefined;
  const emote = currentPage?.emote ?? signatureEmote;

  useEffect(() => {
    // Deferred rather than called straight from the effect body: `Figure`
    // decides whether to play by comparing `replay` to the value it mounted
    // with, so this has to be a genuine change *after* mount, not the
    // initial render's state - queueing it keeps that same one-tick-later
    // change while satisfying the lint rule against a synchronous setState
    // in an effect.
    if (prefersReducedMotion()) return;
    queueMicrotask(() => setReplay(1));
  }, []);

  const next = useCallback(() => {
    if (pages.length === 0) return;
    setPageState((page + 1) % pages.length);
    setReplay((count) => count + 1);
  }, [pages.length, page]);
  const prev = useCallback(() => {
    if (pages.length === 0) return;
    setPageState((page + pages.length - 1) % pages.length);
    setReplay((count) => count + 1);
  }, [pages.length, page]);
  const replayEmote = useCallback(() => setReplay((count) => count + 1), []);

  const value = useMemo(
    () => ({ page, pageCount: pages.length, next, prev, emote, replay, replayEmote }),
    [page, pages.length, next, prev, emote, replay, replayEmote],
  );
  return <StageContext.Provider value={value}>{children}</StageContext.Provider>;
}

export function usePersonaStage(): Stage {
  return useContext(StageContext);
}
