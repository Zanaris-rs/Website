import { describe, expect, it } from "vitest";

import { CATEGORIES, categoryName, isCategory } from "./categories";
import {
  displayName,
  formatNumber,
  windowForRank,
  WINDOW_ROWS,
  xpFromValue,
} from "./format";

describe("categories", () => {
  it("has the twenty the game publishes", () => {
    expect(CATEGORIES).toHaveLength(20);
  });

  it("skips the two disabled stats", () => {
    const ids = CATEGORIES.map((category) => category.id);
    expect(ids).toEqual([...Array(19).keys(), 21]);
    expect(isCategory(19)).toBe(false);
    expect(isCategory(20)).toBe(false);
  });

  it("names the ends of the range", () => {
    expect(categoryName(0)).toBe("Overall");
    expect(categoryName(21)).toBe("Runecrafting");
    expect(categoryName(22)).toBeNull();
  });
});

describe("xpFromValue", () => {
  it("divides the stored value by ten", () => {
    expect(xpFromValue(41_234_567_0)).toBe(41_234_567);
  });

  it("floors rather than rounds, so XP never reads high", () => {
    expect(xpFromValue(19)).toBe(1);
    expect(xpFromValue(0)).toBe(0);
  });
});

describe("formatNumber", () => {
  it("groups thousands", () => {
    expect(formatNumber(275_552_085)).toBe("275,552,085");
    expect(formatNumber(1_523)).toBe("1,523");
  });

  it("leaves small numbers alone", () => {
    expect(formatNumber(99)).toBe("99");
  });
});

describe("displayName", () => {
  it("turns the stored name into the shown name", () => {
    expect(displayName("the_inducted")).toBe("The Inducted");
    expect(displayName("t_b_o_w")).toBe("T B O W");
    expect(displayName("w0rld")).toBe("W0rld");
  });
});

describe("windowForRank", () => {
  it("ends on the requested rank once past the first screen", () => {
    expect(windowForRank(50)).toEqual({ start: 30, end: 50 });
  });

  it("pins to the top of the table for early ranks", () => {
    expect(windowForRank(1)).toEqual({ start: 1, end: 21 });
    expect(windowForRank(5)).toEqual({ start: 1, end: 21 });
    expect(windowForRank(21)).toEqual({ start: 1, end: 21 });
  });

  it("first rank that scrolls is 22", () => {
    expect(windowForRank(22)).toEqual({ start: 2, end: 22 });
  });

  it("is always exactly one screenful", () => {
    for (const rank of [1, 2, 21, 22, 100, 999_999]) {
      const { start, end } = windowForRank(rank);
      expect(end - start + 1).toBe(WINDOW_ROWS);
    }
  });
});
