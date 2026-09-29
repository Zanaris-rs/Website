"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { lineAt, lineCyclesFor, pageCycles } from "@/lib/adventurer-log/overhead";
import type { DialoguePage } from "@/lib/adventurer-log/persona";
import { nearestFacing } from "@/lib/chathead/facing";
import type { Look } from "@/lib/chathead/look";
import type { Emote } from "@/lib/chathead/vocab";
import { onCycle, prefersReducedMotion, subscribeReducedMotion } from "@/lib/game-chat/clock";

/** One line of one page, in that page's colour and effect: overhead chat holds room for it. */
export type HeldLine = { key: string; text: string; colour: number; effect: number };

/** The line said overhead now, in its page's colour and effect. */
export type Said = {
  /** The line being said now: blank while that line is blank (one not yet typed on the Words tab). */
  text: string;
  colour: number;
  effect: number;
  /** Changes whenever a line is said afresh, so its `ChatText` starts a new pass. */
  key: string;
  /**
   * Every line of every page with something in it, the one being said among
   * them: overhead chat keeps room for the tallest, so nothing under it
   * moves as a short line follows one that wraps, or as the pages turn.
   */
  held: readonly HeldLine[];
};

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
   * (one past today's last) is shown once it exists. Either way the page's
   * lines are said again from the first.
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
  /**
   * The line of the current page the figure is saying overhead now, an
   * index into its lines, clamped as `page` is: the dialogue box marks it.
   * 0 with no pages.
   */
  line: number;
  /**
   * That line as overhead chat draws it (`Overhead`), with every page's
   * lines to hold room for: null with no pages, and while none of the
   * page's lines has anything in it (a new page on the Words tab).
   */
  said: Said | null;
  /** The width of overhead chat's scroll window, as `ChatText` measured it (`onScrollWindow`). */
  setScrollWindow(width: number): void;
};

/** No arrival played yet: not any `resetKey`, `undefined` included. */
const NOT_YET = Symbol("not yet");

/** No page, no lines: one constant, so an empty stage's clock is not re-set every render. */
const NO_LINES: readonly string[] = [];

/** The game's own scroll window: the width a scroll line is timed by until overhead chat measures its own. */
const GAME_WINDOW = 100;

/** Off on the server and in the first render, so hydration matches (as `ChatText`). */
const serverReducedMotion = () => false;

const StageContext = createContext<Stage>({
  page: 0, pageCount: 0, next() {}, goTo() {}, emote: null, replay: 0, replayEmote() {},
  facing: 0, setFacing() {}, tryOn: null, setTryOn() {}, line: 0, said: null, setScrollWindow() {},
});

/**
 * The card's figure and the dialogue box share one conversation: continuing
 * the dialogue plays the next page's emote on the figure. They sit in
 * different columns, so the log page wraps both in this. The first emote
 * plays once on arrival, unless the reader prefers reduced motion.
 *
 * While a page is shown the figure says its lines overhead, one after
 * another, in the page's colour and effect (`lib/adventurer-log/overhead.ts`:
 * 150 client cycles a line, or one whole pass for scroll), and after the
 * last starts the page again. A new page - continuing, a Words row, a reset
 * - starts at its first line. With `autoAdvance` (the log, when its owner
 * hides Dialogue, so there is no "Click here to continue") the stage moves
 * to the next page by itself once every line of the page has been said
 * once, playing its emote as continuing would. The count runs on the game's
 * shared clock (`onCycle`); with reduced motion it does not run, and the
 * first line of the page is said, still, as `ChatText` draws it.
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
  autoAdvance = false,
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
  /** Move to the next page by itself once a page's lines have all been said (Dialogue hidden). */
  autoAdvance?: boolean;
  children: ReactNode;
}) {
  const [pageState, setPageState] = useState(0);
  const [replay, setReplay] = useState(0);
  const [facingState, setFacingState] = useState(initialFacing);
  const [tryOn, setTryOnState] = useState<Look | null>(null);
  const [shownKey, setShownKey] = useState(resetKey);
  // Bumped whenever a page is to be said from its first line again.
  const [spoken, setSpoken] = useState(0);
  // The line the clock last heard, for the saying it was heard in.
  const [heard, setHeard] = useState({ key: "", line: 0 });
  const reduced = useSyncExternalStore(subscribeReducedMotion, prefersReducedMotion, serverReducedMotion);
  const [shownReduced, setShownReduced] = useState(reduced);
  // Where the saying began on the clock, and how wide the scroll window is:
  // read and written only by the clock and `ChatText`, never while rendering.
  const started = useRef<{ key: string; at: number } | null>(null);
  const scrollWindow = useRef(GAME_WINDOW);
  // The key whose arrival emote has been asked for, so that asking twice for
  // one arrival (Strict Mode runs the effect twice) plays it once.
  const arrived = useRef<string | number | undefined | typeof NOT_YET>(NOT_YET);
  if (resetKey !== shownKey) {
    // React's "adjust state when a prop changes": set while rendering, so
    // nothing draws the old page or facing first, and nothing remounts.
    setShownKey(resetKey);
    setPageState(0);
    setSpoken((count) => count + 1);
    setFacingState(nearestFacing(initialFacing, turns));
  }
  if (reduced !== shownReduced) {
    // Reduced motion turned on or off mid-page: the page is said afresh, so
    // it stands still on its first line, and moves again from its first
    // line rather than jumping to wherever the clock would have got to.
    setShownReduced(reduced);
    setSpoken((count) => count + 1);
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

  // What is said overhead: the line the clock heard for this saying of this
  // page, else the first. Clamped, as the Words tab's lines can shrink.
  const lines = currentPage?.lines ?? NO_LINES;
  const lineEffect = currentPage?.effect ?? 0;
  const saying = `${page}:${spoken}`;
  const line = reduced ? 0 : heard.key === saying ? Math.min(heard.line, Math.max(0, lines.length - 1)) : 0;
  const text = lines[line] ?? "";
  // The room overhead chat holds: every page's lines, not only this page's,
  // so the card is as tall on every page and turning one moves nothing.
  const held = useMemo<readonly HeldLine[]>(
    () =>
      pages.flatMap((each, p) =>
        each.lines.flatMap((words, l) =>
          words.trim() === "" ? [] : [{ key: `${p}:${l}`, text: words, colour: each.colour, effect: each.effect }],
        ),
      ),
    [pages],
  );
  const said = useMemo<Said | null>(
    () =>
      currentPage && currentPage.lines.some((each) => each.trim() !== "")
        ? { text, colour: currentPage.colour, effect: currentPage.effect, key: `${saying}:${line}`, held }
        : null,
    [currentPage, text, saying, line, held],
  );

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
    setSpoken((count) => count + 1);
    setReplay((count) => count + 1);
  }, [pages.length, page]);

  // Only with a page to move to: one page just starts again, as it would anyway.
  const advances = autoAdvance && pages.length > 1;
  useEffect(() => {
    // The saying's clock. The lines are read afresh on every change (the
    // Words tab's typing), but the saying keeps the cycle it began on, so
    // typing does not start the page again. Below `next`, which it calls.
    if (reduced || lines.length === 0) return;
    let last = -1;
    let moved = false;
    return onCycle((cycle) => {
      if (started.current?.key !== saying) started.current = { key: saying, at: cycle };
      const elapsed = cycle - started.current.at;
      const lineCycles = lineCyclesFor(lineEffect, scrollWindow.current);
      if (advances && !moved && elapsed >= pageCycles(lines, lineCycles)) {
        // Once, as "Click here to continue" does: the next page, its emote, its first line.
        moved = true;
        next();
        return;
      }
      const { index } = lineAt(lines, elapsed, lineCycles);
      if (index === last) return;
      last = index;
      setHeard({ key: saying, line: index });
    });
  }, [reduced, lines, lineEffect, saying, advances, next]);

  const goTo = useCallback((to: number, { play = true }: { play?: boolean } = {}) => {
    setPageState(Math.max(0, to));
    setSpoken((count) => count + 1);
    if (play) setReplay((count) => count + 1);
  }, []);
  const replayEmote = useCallback(() => setReplay((count) => count + 1), []);
  const setFacing = useCallback((f: number) => setFacingState(nearestFacing(f, turns)), [turns]);
  const setTryOn = useCallback((look: Look | null) => setTryOnState(look), []);
  const setScrollWindow = useCallback((width: number) => {
    scrollWindow.current = width;
  }, []);

  const value = useMemo(
    () => ({
      page, pageCount: pages.length, next, goTo, emote, replay, replayEmote, facing, setFacing, tryOn, setTryOn,
      line, said, setScrollWindow,
    }),
    [page, pages.length, next, goTo, emote, replay, replayEmote, facing, setFacing, tryOn, setTryOn, line, said, setScrollWindow],
  );
  return <StageContext.Provider value={value}>{children}</StageContext.Provider>;
}

export function usePersonaStage(): Stage {
  return useContext(StageContext);
}
