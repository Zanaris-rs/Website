import { afterEach, describe, expect, it, vi } from "vitest";

import { prefersReducedMotion, subscribeReducedMotion } from "./clock";

/** A stand-in for `matchMedia` that remembers its change listeners. */
function fakeMatchMedia(matches: boolean) {
  const listeners = new Set<() => void>();
  const query = {
    matches,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  };
  const matchMedia = vi.fn(() => query);
  return { matchMedia, listeners, query };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reduced motion, for useSyncExternalStore", () => {
  it("reads the media query", () => {
    const fake = fakeMatchMedia(true);
    vi.stubGlobal("matchMedia", fake.matchMedia);
    expect(prefersReducedMotion()).toBe(true);
    expect(fake.matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    fake.query.matches = false;
    expect(prefersReducedMotion()).toBe(false);
  });

  it("calls back when the setting changes, until unsubscribed", () => {
    const fake = fakeMatchMedia(false);
    vi.stubGlobal("matchMedia", fake.matchMedia);
    const onChange = vi.fn();
    const unsubscribe = subscribeReducedMotion(onChange);
    expect(fake.listeners.size).toBe(1);
    for (const listener of fake.listeners) listener();
    expect(onChange).toHaveBeenCalledTimes(1);
    unsubscribe();
    expect(fake.listeners.size).toBe(0);
  });

  it("is off, and never calls back, where there is no matchMedia (the server)", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(prefersReducedMotion()).toBe(false);
    const unsubscribe = subscribeReducedMotion(() => {
      throw new Error("never");
    });
    expect(() => unsubscribe()).not.toThrow();
  });
});
