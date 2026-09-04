import { describe, expect, it } from "vitest";

import {
  DEFAULT_PROFILE,
  MAX_RANK,
  parsePlayerParams,
  parseTableParams,
  tableHref,
  type Parsed,
} from "./params";

const query = (search: string) => new URLSearchParams(search);

/** Assert the parse succeeded and hand back the value, for readable tests. */
function ok<T>(parsed: Parsed<T>): T {
  if (!parsed.ok) {
    expect.unreachable(`expected a parse, got ${parsed.error}`);
  }
  return parsed.value;
}

describe("parseTableParams", () => {
  it("defaults to Overall on the main profile", () => {
    expect(ok(parseTableParams(query("")))).toEqual({
      profile: DEFAULT_PROFILE,
      category: 0,
      selection: { kind: "top" },
    });
  });

  it("reads a category", () => {
    expect(ok(parseTableParams(query("category=21")))).toMatchObject({
      category: 21,
    });
  });

  it("rejects a category the game does not have", () => {
    expect(parseTableParams(query("category=19"))).toEqual({
      ok: false,
      error: "bad_category",
    });
    expect(parseTableParams(query("category=abc"))).toEqual({
      ok: false,
      error: "bad_category",
    });
  });

  it("reads a rank", () => {
    expect(ok(parseTableParams(query("rank=500")))).toMatchObject({
      selection: { kind: "rank", rank: 500 },
    });
  });

  it("rejects ranks that are not a position in a table", () => {
    for (const bad of ["0", "-1", "1.5", "1e6", "999999999999", "abc"]) {
      expect(parseTableParams(query(`rank=${encodeURIComponent(bad)}`))).toEqual(
        { ok: false, error: "bad_rank" },
      );
    }
  });

  it("caps the rank so a query cannot ask Postgres to rank the world", () => {
    expect(ok(parseTableParams(query(`rank=${MAX_RANK}`)))).toMatchObject({
      selection: { kind: "rank", rank: MAX_RANK },
    });
    expect(parseTableParams(query(`rank=${MAX_RANK + 1}`))).toEqual({
      ok: false,
      error: "bad_rank",
    });
  });

  it("canonicalises a searched name the way the game would", () => {
    expect(ok(parseTableParams(query("name=The+Inducted")))).toMatchObject({
      selection: { kind: "name", username: "the_inducted" },
    });
    expect(ok(parseTableParams(query("username=BOB_")))).toMatchObject({
      selection: { kind: "name", username: "bob" },
    });
  });

  it("rejects a name base37 cannot encode", () => {
    expect(parseTableParams(query("name=%21%21%21"))).toEqual({
      ok: false,
      error: "bad_name",
    });
  });

  it("treats an empty search box as no search", () => {
    expect(ok(parseTableParams(query("name=&rank=")))).toMatchObject({
      selection: { kind: "top" },
    });
    // A submitted-but-blank box arrives as whitespace, not an error.
    expect(ok(parseTableParams(query("rank=%20%20")))).toMatchObject({
      selection: { kind: "top" },
    });
  });

  it("prefers a name over a rank when both are present", () => {
    expect(ok(parseTableParams(query("rank=500&name=bob")))).toMatchObject({
      selection: { kind: "name", username: "bob" },
    });
  });

  it("validates the profile", () => {
    expect(ok(parseTableParams(query("profile=beta-week8")))).toMatchObject({
      profile: "beta-week8",
    });
    for (const bad of ["Main", "main;drop", "-x", "a".repeat(33)]) {
      expect(
        parseTableParams(query(`profile=${encodeURIComponent(bad)}`)),
      ).toEqual({ ok: false, error: "bad_profile" });
    }
  });
});

describe("parsePlayerParams", () => {
  it("canonicalises the path segment", () => {
    expect(ok(parsePlayerParams("The%20Inducted", query("")))).toEqual({
      profile: DEFAULT_PROFILE,
      username: "the_inducted",
    });
  });

  it("rejects a segment that is not a name", () => {
    expect(parsePlayerParams("%21", query(""))).toEqual({
      ok: false,
      error: "bad_name",
    });
  });

  it("survives a malformed percent escape", () => {
    expect(parsePlayerParams("%E0%A4%A", query(""))).toEqual({
      ok: false,
      error: "bad_name",
    });
  });
});

describe("tableHref", () => {
  it("keeps the default profile out of the URL", () => {
    expect(tableHref({ category: 3 })).toBe("/hiscores?category=3");
  });

  it("carries a search through a category change", () => {
    expect(
      tableHref({
        profile: DEFAULT_PROFILE,
        category: 7,
        selection: { kind: "name", username: "the_inducted" },
      }),
    ).toBe("/hiscores?category=7&username=the_inducted");
  });

  it("carries a rank", () => {
    expect(
      tableHref({ category: 0, selection: { kind: "rank", rank: 500 } }),
    ).toBe("/hiscores?category=0&rank=500");
  });
});
