import { formatNumber, xpFromValue } from "@/lib/hiscores/format";

/**
 * How records read on the page. XP arrives raw (the engine's x10) and leaves
 * as players see it, through the same `xpFromValue` the hiscores use.
 */

function clock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

/**
 * How long a finished attempt took, `5:04`. Floored to the second: a window
 * of 5:10.9 is shown as 5:10, which is inside a 10-second grace - and so is
 * the attempt, because the database compares milliseconds, not this string.
 */
export function formatElapsed(ms: number): string {
  return clock(Math.max(0, Math.floor(ms / 1000)));
}

/**
 * Time left on a running timer, `4:59`. Rounded up, so the counter reads 0:00
 * at the instant the window closes rather than a second before it.
 */
export function formatCountdown(ms: number): string {
  return clock(Math.max(0, Math.ceil(ms / 1000)));
}

/** A raw gain as players see it: `+12,345`. */
export function formatGain(value: number): string {
  return `+${formatNumber(xpFromValue(value))}`;
}

/** `1st`, `2nd`, `3rd`, `11th`, `22nd`. */
export function ordinal(rank: number): string {
  const tens = rank % 100;
  if (tens >= 11 && tens <= 13) return `${rank}th`;
  switch (rank % 10) {
    case 1:
      return `${rank}st`;
    case 2:
      return `${rank}nd`;
    case 3:
      return `${rank}rd`;
    default:
      return `${rank}th`;
  }
}
