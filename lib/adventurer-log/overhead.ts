import { scrollPass } from "@/lib/game-chat/effects";
import { stringWidth } from "@/lib/game-chat/metrics";

/**
 * Overhead chat that follows the dialogue: while a page is shown, the figure
 * says its lines one after another, in the page's colour and effect, and
 * after the last starts the page again. Pure, so `PersonaStage` only has to
 * count cycles since the page began.
 */

/** How long a line is said: the game's chat life (`CHAT_LIFE`), 150 client cycles (3 s). */
export const LINE_CYCLES = 150;

/**
 * Each line's length in whole cycles, at least one: the one rule `lineAt`
 * and `pageCycles` share, so a page ends exactly where `lineAt` starts it
 * again.
 */
function lineLengths(lines: readonly string[], lineCycles: (line: string) => number): number[] {
  return lines.map((line) => Math.max(1, Math.floor(lineCycles(line))));
}

function sum(lengths: readonly number[]): number {
  return lengths.reduce((total, length) => total + length, 0);
}

/**
 * The line being said `cycles` cycles after the page began, and the cycle
 * (counted from the page's start) it began on. Each line lasts
 * `lineCycles(line)` cycles, at least one; after the last line the page
 * starts again. Before the page began, or with no lines, it is line 0 at 0.
 */
export function lineAt(
  lines: readonly string[],
  cycles: number,
  lineCycles: (line: string) => number,
): { index: number; startedAt: number } {
  if (lines.length === 0) return { index: 0, startedAt: 0 };
  const lengths = lineLengths(lines, lineCycles);
  const total = sum(lengths);
  const at = Math.max(0, Math.floor(cycles));
  let startedAt = at - (at % total);
  let index = 0;
  while (at >= startedAt + lengths[index]) {
    startedAt += lengths[index];
    index++;
  }
  return { index, startedAt };
}

/**
 * How long all of a page's lines take to say once, each at least a cycle:
 * the cycle `lineAt` starts the page again on. With Dialogue hidden, the
 * log moves to the next page then (`PersonaStage`'s `autoAdvance`).
 */
export function pageCycles(lines: readonly string[], lineCycles: (line: string) => number): number {
  return sum(lineLengths(lines, lineCycles));
}

/**
 * `lineAt`'s `lineCycles` for a page in `effect`: `LINE_CYCLES` a line, or
 * for scroll one whole pass of it (`scrollPass`) through a window
 * `window` px wide - the width `ChatText` measured for its scroll window, so
 * a line is never cut off mid-pass.
 */
export function lineCyclesFor(effect: number, window: number): (line: string) => number {
  if (effect !== 2) return () => LINE_CYCLES;
  return (line) => scrollPass(stringWidth(line, "b12"), window);
}
