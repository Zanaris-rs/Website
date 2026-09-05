import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ORIGINAL_RULES, ruleImage } from "./original";

describe("ORIGINAL_RULES", () => {
  it("is twelve rules, numbered 1 to 12 in order", () => {
    expect(ORIGINAL_RULES).toHaveLength(12);
    expect(ORIGINAL_RULES.map((rule) => rule.n)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it("gives every rule a caption and something to say", () => {
    for (const rule of ORIGINAL_RULES) {
      expect(rule.caption.length).toBeGreaterThan(0);
      expect(rule.text.length).toBeGreaterThan(0);
      for (const paragraph of rule.text) {
        expect(paragraph.trim()).toBe(paragraph);
        expect(paragraph.length).toBeGreaterThan(0);
      }
      expect(rule.height).toBeGreaterThan(0);
    }
  });

  it("points at an illustration that is actually vendored", () => {
    for (const rule of ORIGINAL_RULES) {
      const href = ruleImage(rule);
      expect(href).toBe(`/img/rules/${rule.image}.jpg`);
      expect(existsSync(join(process.cwd(), "public", href))).toBe(true);
    }
  });

  it("uses each illustration once", () => {
    const images = ORIGINAL_RULES.map((rule) => rule.image);
    expect(new Set(images).size).toBe(images.length);
  });

  it("names Zanaris where the rule names the operator, not the game", () => {
    const byNumber = new Map(ORIGINAL_RULES.map((rule) => [rule.n, rule]));
    for (const n of [4, 5, 10]) {
      expect(byNumber.get(n)!.text.join(" ")).toContain("Zanaris");
    }
    // And nowhere does the text still credit Jagex with running this server.
    for (const rule of ORIGINAL_RULES) {
      expect(rule.text.join(" ")).not.toContain("Jagex");
      expect(rule.caption).not.toContain("Jagex");
    }
  });
});
