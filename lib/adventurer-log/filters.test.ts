import { describe, expect, it } from "vitest";

import { FILTERS, filterOf, showsPosts, visibleFilters } from "./filters";

const slugs = (filters: readonly { slug: string }[]) => filters.map((filter) => filter.slug);

describe("FILTERS", () => {
  it("are the six buttons, in order, with the masks migration 15's p_show takes", () => {
    expect(FILTERS).toEqual([
      { slug: "all", label: "Everything", mask: null },
      { slug: "posts", label: "Posts", mask: 256 },
      { slug: "levels", label: "Levels", mask: (1 << 1) | (1 << 2) },
      { slug: "quests", label: "Quests", mask: 1 << 3 },
      { slug: "drops", label: "Drops", mask: 1 << 4 },
      { slug: "clues", label: "Clues", mask: 1 << 5 },
    ]);
  });
});

describe("filterOf", () => {
  it("finds a filter by its slug", () => {
    expect(filterOf("quests")).toEqual({ slug: "quests", label: "Quests", mask: 8 });
    expect(filterOf("levels").mask).toBe(6);
    expect(filterOf("posts").mask).toBe(256);
  });

  it("is Everything for nothing, or anything it does not know", () => {
    for (const raw of [null, undefined, "", "QUESTS", " quests", "random", "__proto__", "toString", "all"]) {
      expect(filterOf(raw)).toEqual({ slug: "all", label: "Everything", mask: null });
    }
  });
});

describe("visibleFilters", () => {
  it("is every filter when the owner hides nothing", () => {
    expect(slugs(visibleFilters(0))).toEqual(["all", "posts", "levels", "quests", "drops", "clues"]);
  });

  it("drops a category's filter when the owner hides it", () => {
    expect(slugs(visibleFilters(1 << 4))).toEqual(["all", "posts", "levels", "quests", "clues"]);
    expect(slugs(visibleFilters((1 << 3) | (1 << 5)))).toEqual(["all", "posts", "levels", "drops"]);
  });

  it("keeps Levels while either of its two kinds shows", () => {
    expect(slugs(visibleFilters(1 << 1))).toContain("levels");
    expect(slugs(visibleFilters(1 << 2))).toContain("levels");
    expect(slugs(visibleFilters((1 << 1) | (1 << 2)))).not.toContain("levels");
  });

  it("never drops Everything or Posts, whatever is hidden", () => {
    expect(slugs(visibleFilters(255))).toEqual(["all", "posts"]);
  });

  it("ignores kinds no filter is for", () => {
    expect(slugs(visibleFilters((1 << 0) | (1 << 6) | (1 << 7)))).toEqual(slugs(FILTERS));
  });
});

describe("showsPosts", () => {
  it("is true for Everything and Posts only", () => {
    expect(FILTERS.filter(showsPosts).map((filter) => filter.slug)).toEqual(["all", "posts"]);
  });
});
