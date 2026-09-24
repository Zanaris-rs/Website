import { describe, expect, it } from "vitest";

import { ASSET_RESULTS, searchAssets } from "./assets";
import { parseBody } from "./body";
import { parseResolve, parseStaffReports, staffResolveStatement } from "./staff";

describe("searchAssets", () => {
  it("finds items and skills, names starting with the query first", () => {
    const matches = searchAssets("rune plate");
    expect(matches[0]).toMatchObject({ kind: "item", name: "Rune platebody", code: "[item:rune_platebody]" });
    expect(matches.every((match) => match.name.toLowerCase().includes("rune plate"))).toBe(true);
    expect(searchAssets("wood").some((match) => match.kind === "skill" && match.code === "[skill:woodcutting]")).toBe(true);
  });

  it("offers codes the post parser turns back into the same picture", () => {
    for (const match of searchAssets("dragon")) {
      const [token] = parseBody(match.code);
      expect(token.t).toBe(match.kind);
    }
  });

  it("never offers a bank note, and stops at a page of results", () => {
    expect(searchAssets("a").length).toBe(0); // too short to search
    const many = searchAssets("ore");
    expect(many.length).toBeLessThanOrEqual(ASSET_RESULTS);
    expect(many.some((match) => match.code.startsWith("[item:cert_"))).toBe(false);
  });
});

describe("staff reports", () => {
  it("parse strictly", () => {
    const [report] = parseStaffReports([
      {
        id: 3,
        target_kind: "log",
        target_id: 9,
        log_owner: "hero",
        author: "hero",
        reporter: "fan",
        reason: "css",
        created_at: "2026-09-24T12:00:00Z",
        content: "h\n\na",
        css: ".al-page{}",
        content_state: "shown",
        resolved_at: null,
        resolution: null,
        resolved_by: null,
        note: null,
      },
    ]);
    expect(report).toMatchObject({ id: 3, targetKind: "log", css: ".al-page{}", resolvedAt: null });
    expect(() => parseStaffReports([{ target_kind: "wall" }])).toThrow(/kind/);
  });

  it("resolve with the candidate hash as a value", () => {
    const statement = staffResolveStatement("mod", "$2b$10$x", 3, "hide", "");
    expect(statement.text).toBe("select accounts.staff_adventure_resolve($1, $2, $3, $4, $5) as result");
    expect(statement.values).toEqual(["mod", "$2b$10$x", 3, "hide", ""]);
    expect(parseResolve("bad_credentials")).toBe("bad_credentials");
    expect(() => parseResolve("maybe")).toThrow();
  });
});
