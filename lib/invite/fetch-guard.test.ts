import { describe, expect, it } from "vitest";

import { isTopLevelNavigation } from "./fetch-guard";

function headersWith(dest: string | null): { get(name: string): string | null } {
  return { get: (name) => (name === "sec-fetch-dest" ? dest : null) };
}

describe("isTopLevelNavigation", () => {
  it("is true when sec-fetch-dest is absent (old browsers, link unfurlers)", () => {
    expect(isTopLevelNavigation(headersWith(null))).toBe(true);
  });

  it("is true for a real navigation", () => {
    expect(isTopLevelNavigation(headersWith("document"))).toBe(true);
  });

  it.each(["image", "iframe", "empty", "script"])(
    "is false when the browser is only fetching it as a %s",
    (dest) => {
      expect(isTopLevelNavigation(headersWith(dest))).toBe(false);
    },
  );
});
