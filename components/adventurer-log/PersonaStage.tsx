"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { DialoguePage } from "@/lib/adventurer-log/persona";
import type { Emote } from "@/lib/chathead/vocab";
import { prefersReducedMotion } from "@/lib/game-chat/clock";

type Stage = {
  page: number;
  pageCount: number;
  next(): void;
  /** The emote the figure acts out now: this page's, or the signature one. */
  emote: Emote | null;
  /** Bumped to make the figure play `emote` once. */
  replay: number;
  replayEmote(): void;
};

const StageContext = createContext<Stage>({
  page: 0, pageCount: 0, next() {}, emote: null, replay: 0, replayEmote() {},
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
  signatureEmote: Emote | null;
  children: ReactNode;
}) {
  const [page, setPage] = useState(0);
  const [replay, setReplay] = useState(0);
  const pageEmote = pages.length > 0 ? pages[Math.min(page, pages.length - 1)].emote : null;
  const emote = pages.some((p) => p.emote !== null) ? pageEmote : signatureEmote;

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
    setPage((current) => (current + 1) % pages.length);
    setReplay((count) => count + 1);
  }, [pages.length]);
  const replayEmote = useCallback(() => setReplay((count) => count + 1), []);

  const value = useMemo(
    () => ({ page, pageCount: pages.length, next, emote, replay, replayEmote }),
    [page, pages.length, next, emote, replay, replayEmote],
  );
  return <StageContext.Provider value={value}>{children}</StageContext.Provider>;
}

export function usePersonaStage(): Stage {
  return useContext(StageContext);
}
