import { CYCLE_MS } from "./effects";

/**
 * One shared 50 Hz game clock for everything animated on a page - chat
 * effects, emotes, chathead moods - on one requestAnimationFrame, running
 * only while something listens. Listeners hear each client cycle once.
 */
const listeners = new Set<(cycle: number) => void>();
let frame = 0;
let last = -1;

function tick(now: number) {
  const cycle = Math.floor(now / CYCLE_MS);
  if (cycle !== last) {
    last = cycle;
    for (const listener of listeners) listener(cycle);
  }
  frame = listeners.size > 0 ? requestAnimationFrame(tick) : 0;
}

export function onCycle(listener: (cycle: number) => void): () => void {
  listeners.add(listener);
  if (!frame) frame = requestAnimationFrame(tick);
  return () => {
    listeners.delete(listener);
  };
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia(REDUCED_MOTION).matches;
}

/**
 * `useSyncExternalStore`'s subscribe for `prefersReducedMotion`: calls back
 * when the setting changes. Where there is no `matchMedia` (the server) it
 * never does.
 */
export function subscribeReducedMotion(onChange: () => void): () => void {
  if (typeof matchMedia !== "function") return () => {};
  const query = matchMedia(REDUCED_MOTION);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
