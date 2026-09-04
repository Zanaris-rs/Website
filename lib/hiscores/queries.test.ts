import { describe, expect, it } from "vitest";

import { CATEGORIES } from "./categories";
import { playerQuery, sourceFor, tableQuery } from "./queries";

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

describe("sourceFor", () => {
  it("reads Overall from the large table", () => {
    expect(sourceFor(0)).toEqual({
      view: "hiscores.hiscore_large_public",
      type: 0,
    });
  });

  it("reads a skill from the skill table, keyed by the category id", () => {
    expect(sourceFor(21)).toEqual({ view: "hiscores.hiscore_public", type: 21 });
  });
});

describe("tableQuery", () => {
  it("asks for the first 21 rows by default", () => {
    const statement = tableQuery({
      profile: "main",
      category: 0,
      selection: { kind: "top" },
    });
    expect(statement.values).toEqual(["main", 0, 1, 21]);
    expect(squash(statement.text)).toContain(
      "from hiscores.hiscore_large_public where profile = $1 and type = $2",
    );
    expect(squash(statement.text)).toContain("where rank between $3 and $4");
  });

  it("ranks by value, then who got there first, then account id", () => {
    const statement = tableQuery({
      profile: "main",
      category: 1,
      selection: { kind: "top" },
    });
    expect(squash(statement.text)).toContain(
      "row_number() over (order by value desc, date asc, account_id asc)",
    );
  });

  it("windows a rank search on [max(1, R-20) .. max(21, R)]", () => {
    expect(
      tableQuery({
        profile: "main",
        category: 4,
        selection: { kind: "rank", rank: 50 },
      }).values,
    ).toEqual(["main", 4, 30, 50]);

    expect(
      tableQuery({
        profile: "main",
        category: 4,
        selection: { kind: "rank", rank: 5 },
      }).values,
    ).toEqual(["main", 4, 1, 21]);
  });

  it("resolves a name to its rank inside the same CTE", () => {
    const statement = tableQuery({
      profile: "main",
      category: 2,
      selection: { kind: "name", username: "the_inducted" },
    });
    expect(statement.values).toEqual(["main", 2, "the_inducted"]);
    const text = squash(statement.text);
    expect(text).toContain("found as ( select rank from ranked where username = $3 )");
    expect(text).toContain("greatest(1, f.rank - 20) and greatest(21, f.rank)");
    // One statement, so one round trip: no second lookup for the rank.
    expect(text.match(/with ranked as/g)).toHaveLength(1);
  });

  it("never interpolates a value", () => {
    for (const category of CATEGORIES) {
      for (const selection of [
        { kind: "top" } as const,
        { kind: "rank", rank: 999 } as const,
        { kind: "name", username: "bob" } as const,
      ]) {
        const { text } = tableQuery({
          profile: "'; drop table account; --",
          category: category.id,
          selection,
        });
        expect(text).not.toContain("drop table");
        expect(text).not.toContain("bob");
      }
    }
  });
});

describe("playerQuery", () => {
  const statement = playerQuery({ profile: "main", username: "detective" });

  it("passes the profile and username as parameters", () => {
    expect(statement.values).toEqual(["main", "detective"]);
    expect(statement.text).not.toContain("detective");
  });

  it("unions Overall with the skills so one round trip fills the page", () => {
    const text = squash(statement.text);
    expect(text).toContain("union all");
    expect(text).toContain("from hiscores.hiscore_large_public h");
    expect(text).toContain("from hiscores.hiscore_public h");
    expect(text.endsWith("order by category")).toBe(true);
  });

  it("ranks each row with a correlated count, tie-breaks included", () => {
    const text = squash(statement.text);
    expect(text).toContain("select count(*) + 1");
    expect(text).toContain("o.value > h.value");
    expect(text).toContain("o.date < h.date");
    expect(text).toContain("o.account_id < h.account_id");
  });
});
