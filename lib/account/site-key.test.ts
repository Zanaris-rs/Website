import { describe, expect, it } from "vitest";

import { DEFAULT_TURNSTILE_SITE_KEY, turnstileSiteKey } from "./site-key";

describe("turnstileSiteKey", () => {
  it("falls back to the live widget when the variable is unset", () => {
    expect(turnstileSiteKey(undefined)).toBe(DEFAULT_TURNSTILE_SITE_KEY);
    expect(turnstileSiteKey(null)).toBe(DEFAULT_TURNSTILE_SITE_KEY);
  });

  it("treats an empty or whitespace-only value as unset", () => {
    // A Vercel variable added and left blank should behave like one that was
    // never added, not like a site key made of spaces.
    expect(turnstileSiteKey("")).toBe(DEFAULT_TURNSTILE_SITE_KEY);
    expect(turnstileSiteKey("   ")).toBe(DEFAULT_TURNSTILE_SITE_KEY);
  });

  it("prefers a configured key, trimmed", () => {
    expect(turnstileSiteKey("0xOTHER")).toBe("0xOTHER");
    expect(turnstileSiteKey("  0xOTHER \n")).toBe("0xOTHER");
  });

  it("ships the real widget's key", () => {
    // Pinned deliberately: this is the value the register page renders and the
    // one production is checked against. Site keys are public.
    expect(DEFAULT_TURNSTILE_SITE_KEY).toBe("0x4AAAAAAEoMC04y54IPJd-n");
  });
});
