import { describe, expect, it } from "vitest";

import { ECONOMY_WINDOWS, economyWindow } from "./queries";
import { ECONOMY_SECTIONS, economyHref, economySection } from "./sections";

const window = (slug: string) => {
  const found = economyWindow(slug);
  if (!found) throw new Error(`no window ${slug}`);
  return found;
};

describe("ECONOMY_SECTIONS", () => {
  it("never shares a slug with a window, so neither can shadow the other in the route", () => {
    const windows = new Set(ECONOMY_WINDOWS.map((w) => w.slug));
    for (const section of ECONOMY_SECTIONS) {
      expect(windows.has(section.slug)).toBe(false);
    }
  });

  it("gives the overview the empty slug, because /economy is the overview", () => {
    expect(ECONOMY_SECTIONS[0]).toMatchObject({ key: "overview", slug: "" });
  });

  it("names every section once", () => {
    const slugs = ECONOMY_SECTIONS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("economyHref", () => {
  it("leaves the default window off the overview, so /economy has one URL", () => {
    expect(economyHref(window("30-days"))).toBe("/economy");
  });

  it("puts another window on the overview under /economy", () => {
    expect(economyHref(window("7-days"))).toBe("/economy/7-days");
  });

  it("keeps a windowed section's tabs inside that section", () => {
    expect(economyHref(window("7-days"), "rares")).toBe("/economy/rares/7-days");
    expect(economyHref(window("30-days"), "rares")).toBe("/economy/rares");
  });

  it("ignores the window for a section that does not take one", () => {
    expect(economyHref(window("7-days"), "items")).toBe("/economy/items");
    expect(economyHref(window("90-days"), "about")).toBe("/economy/about");
  });
});

describe("economySection", () => {
  it("finds a section by key", () => {
    expect(economySection("rares")?.slug).toBe("rares");
  });

  it("returns null for anything else, which the route turns into a 404", () => {
    expect(economySection("coins")).toBeNull();
  });
});
