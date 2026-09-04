import { toDisplayName } from "@/lib/base37";

/** How many rows a hiscores table shows. Fixed in 2004, fixed here. */
export const WINDOW_ROWS = 21;

/**
 * XP as players see it. The engine stores experience multiplied by ten so it
 * can keep the fractional part, so every display divides by ten and floors.
 */
export function xpFromValue(value: number): number {
  return Math.floor(value / 10);
}

/** `1234567` -> `1,234,567`. Fixed locale: the 2004 site was en-GB. */
export function formatNumber(value: number): string {
  return value.toLocaleString("en-GB");
}

/** `the_inducted` -> `The Inducted`. */
export function displayName(username: string): string {
  return toDisplayName(username);
}

export type RankWindow = {
  /** First rank shown, 1-based and inclusive. */
  readonly start: number;
  /** Last rank shown, inclusive. */
  readonly end: number;
};

/**
 * The 21-row window around a rank: `[max(1, R - 20) .. max(21, R)]`.
 *
 * So rank 50 shows 30-50 with 50 at the bottom, and any rank in the first 21
 * shows 1-21 with the row highlighted in place. There are no page links; this
 * window *is* the pagination.
 */
export function windowForRank(rank: number): RankWindow {
  const end = Math.max(WINDOW_ROWS, rank);
  return { start: Math.max(1, end - (WINDOW_ROWS - 1)), end };
}
