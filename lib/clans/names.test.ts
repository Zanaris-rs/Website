import { describe, expect, it } from "vitest";

import { CLAN_LIMITS, clanNameOk, clanNameShapeOk, clanSlug, slugFrom } from "./names";

describe("CLAN_LIMITS", () => {
  it("are the spec's numbers", () => {
    expect(CLAN_LIMITS).toEqual({ name: 20, motto: 80, about: 600, noticeTitle: 40, noticeBody: 200, members: 50, invites: 20 });
  });
});

describe("clanNameOk", () => {
  it("takes letters, digits and single spaces, 1 to 20 long", () => {
    for (const good of ["Varrock Knights", "A", "abc123", "x".repeat(20), "Clan 12a", "Clans 1", "9 Lives"]) {
      expect(clanNameOk(good), good).toBe(true);
    }
  });

  it("refuses edge spaces, double spaces, other characters and the length", () => {
    for (const bad of ["", " Lead", "Lead ", "Two  Spaces", "x".repeat(21), "hy-phen", "under_score", "Émile", "a\nb"]) {
      expect(clanNameOk(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it("keeps names like Clan 123 for staff renames, in any case", () => {
    for (const reserved of ["Clan 123", "clan 7", "CLAN 1"]) expect(clanNameOk(reserved), reserved).toBe(false);
  });
});

describe("clanNameShapeOk", () => {
  it("is the length and the characters only, so a staff Clan 123 passes", () => {
    for (const good of ["Varrock Knights", "A", "Clan 123", "clan 7", "x".repeat(20)]) {
      expect(clanNameShapeOk(good), good).toBe(true);
    }
    for (const bad of ["", " Lead", "Lead ", "Two  Spaces", "x".repeat(21), "hy-phen", "Émile", "a\nb"]) {
      expect(clanNameShapeOk(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("clanSlug", () => {
  it("lower-cases and turns each space into a dash", () => {
    expect(clanSlug("Varrock Knights")).toBe("varrock-knights");
    expect(clanSlug("A B C")).toBe("a-b-c");
    expect(clanSlug("Clan 12")).toBe("clan-12");
  });
});

describe("slugFrom", () => {
  it("reads a URL segment as the slug it names", () => {
    expect(slugFrom("varrock-knights")).toBe("varrock-knights");
    expect(slugFrom("Varrock-Knights")).toBe("varrock-knights");
    expect(slugFrom("varrock%20knights")).toBe("varrock-knights");
    expect(slugFrom("clan-12")).toBe("clan-12");
  });

  it("is null for anything no clan could have", () => {
    for (const bad of ["", "%E0%A4%A", "a--b", "-a", "a-", "x".repeat(21), "a_b", "..", "a%2Fb"]) {
      expect(slugFrom(bad), bad).toBeNull();
    }
  });
});
