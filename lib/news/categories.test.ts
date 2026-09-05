import { describe, expect, it } from "vitest";

import {
  CATEGORIES,
  CATEGORY_NAMES,
  categoryByName,
  categoryBySlug,
} from "./categories";

describe("CATEGORIES", () => {
  it("is the six categories with their 2004 colours", () => {
    expect(
      CATEGORIES.map((category) => [category.name, category.style]),
    ).toEqual([
      ["Game Updates", "red"],
      ["Website", "lblue"],
      ["Customer Support", "yellow"],
      ["Technical", "dblue"],
      ["Community", "green"],
      ["Behind the Scenes", "purple"],
    ]);
  });

  it("has unique names, slugs and colours", () => {
    expect(new Set(CATEGORY_NAMES).size).toBe(CATEGORIES.length);
    expect(new Set(CATEGORIES.map((c) => c.slug)).size).toBe(CATEGORIES.length);
    expect(new Set(CATEGORIES.map((c) => c.style)).size).toBe(CATEGORIES.length);
  });

  it("has URL-safe slugs", () => {
    for (const category of CATEGORIES) {
      expect(category.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(encodeURIComponent(category.slug)).toBe(category.slug);
    }
  });
});

describe("lookups", () => {
  it("finds a category by its frontmatter name", () => {
    expect(categoryByName("Behind the Scenes")?.slug).toBe("behind-the-scenes");
  });

  it("finds a category by its URL slug", () => {
    expect(categoryBySlug("customer-support")?.name).toBe("Customer Support");
  });

  it("is undefined for anything else, rather than a default", () => {
    expect(categoryByName("website")).toBeUndefined();
    expect(categoryBySlug("Website")).toBeUndefined();
    expect(categoryBySlug("archived")).toBeUndefined();
  });
});
