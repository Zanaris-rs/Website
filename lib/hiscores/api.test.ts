import { describe, expect, it } from "vitest";

import {
  parseHiscoresResponse,
  parsePlayerResponse,
  toHiscoresResponse,
  toPlayerResponse,
} from "./api";
import { displayName } from "./format";
import type { PlayerRow, TableRow } from "./queries";

const rows: TableRow[] = [
  { rank: 30, username: "charisma", level: 99, value: 89_077_830 },
  { rank: 31, username: "t_b_o_w", level: 99, value: 88_993_600 },
  { rank: 32, username: "boring_life", level: 98, value: 88_452_950 },
];

describe("toHiscoresResponse", () => {
  it("adds the display name and divides XP by ten", () => {
    const response = toHiscoresResponse(
      { profile: "main", category: 1, selection: { kind: "top" } },
      rows,
      displayName,
    );

    expect(response.rows[1]).toEqual({
      rank: 31,
      username: "t_b_o_w",
      name: "T B O W",
      level: 99,
      xp: 8_899_360,
    });
    expect(response.profile).toBe("main");
    expect(response.category).toBe(1);
  });

  it("highlights nothing for a plain table", () => {
    expect(
      toHiscoresResponse(
        { profile: "main", category: 1, selection: { kind: "top" } },
        rows,
        displayName,
      ).highlight,
    ).toBeNull();
  });

  it("highlights the row at the searched rank", () => {
    expect(
      toHiscoresResponse(
        { profile: "main", category: 1, selection: { kind: "rank", rank: 32 } },
        rows,
        displayName,
      ).highlight,
    ).toBe("boring_life");
  });

  it("highlights the searched player", () => {
    expect(
      toHiscoresResponse(
        {
          profile: "main",
          category: 1,
          selection: { kind: "name", username: "t_b_o_w" },
        },
        rows,
        displayName,
      ).highlight,
    ).toBe("t_b_o_w");
  });

  it("highlights nothing when the row is not in the window", () => {
    // A rank past the end of the table: the plan says show an empty table, and
    // a stray highlight would be worse than none.
    expect(
      toHiscoresResponse(
        { profile: "main", category: 1, selection: { kind: "rank", rank: 999 } },
        [],
        displayName,
      ).highlight,
    ).toBeNull();
    expect(
      toHiscoresResponse(
        {
          profile: "main",
          category: 1,
          selection: { kind: "name", username: "nobody" },
        },
        [],
        displayName,
      ).highlight,
    ).toBeNull();
  });
});

describe("toPlayerResponse", () => {
  const playerRows: PlayerRow[] = [
    {
      category: 0,
      username: "detective",
      account_id: 7,
      level: 1872,
      value: 2_755_520_850,
      rank: 1,
    },
    {
      category: 1,
      username: "detective",
      account_id: 7,
      level: 99,
      value: 131_746_840,
      rank: 17,
    },
  ];

  it("shapes the personal page", () => {
    expect(toPlayerResponse("detective", playerRows, displayName)).toEqual({
      username: "detective",
      name: "Detective",
      citizen: 7,
      skills: [
        { category: 0, rank: 1, level: 1872, xp: 275_552_085 },
        { category: 1, rank: 17, level: 99, xp: 13_174_684 },
      ],
    });
  });
});

describe("parseHiscoresResponse", () => {
  const body = {
    profile: "main",
    category: 0,
    highlight: "smeltz",
    rows: [
      {
        rank: 480,
        username: "repose",
        name: "Repose",
        level: 1523,
        xp: 41_234_567,
      },
    ],
  };

  it("accepts the documented shape", () => {
    expect(parseHiscoresResponse(body)).toEqual(body);
  });

  it("accepts a null highlight", () => {
    expect(parseHiscoresResponse({ ...body, highlight: null }).highlight).toBe(
      null,
    );
  });

  it("accepts an empty table", () => {
    expect(
      parseHiscoresResponse({ ...body, rows: [], highlight: null }).rows,
    ).toEqual([]);
  });

  it("rejects anything else, so the page shows a failure state", () => {
    expect(() => parseHiscoresResponse(null)).toThrow();
    expect(() => parseHiscoresResponse([])).toThrow();
    expect(() => parseHiscoresResponse({ ...body, rows: {} })).toThrow();
    expect(() => parseHiscoresResponse({ ...body, highlight: 7 })).toThrow();
    expect(() =>
      parseHiscoresResponse({ ...body, rows: [{ rank: "480" }] }),
    ).toThrow();
  });
});

describe("parsePlayerResponse", () => {
  const body = {
    username: "detective",
    name: "Detective",
    citizen: 7,
    skills: [{ category: 0, rank: 1, level: 1872, xp: 275_552_085 }],
  };

  it("accepts the documented shape", () => {
    expect(parsePlayerResponse(body)).toEqual(body);
  });

  it("rejects a missing name", () => {
    expect(() => parsePlayerResponse({ ...body, name: "" })).toThrow();
  });

  it("rejects a skill row with a missing field", () => {
    expect(() =>
      parsePlayerResponse({ ...body, skills: [{ category: 0, rank: 1 }] }),
    ).toThrow();
  });

  it("reads a response cached from before the citizen number existed", () => {
    const old = { username: body.username, name: body.name, skills: body.skills };
    expect(parsePlayerResponse(old)).toEqual({ ...old, citizen: null });
  });

  it("drops a citizen number that is not a positive whole number", () => {
    expect(parsePlayerResponse({ ...body, citizen: "7" }).citizen).toBeNull();
    expect(parsePlayerResponse({ ...body, citizen: 0 }).citizen).toBeNull();
  });
});
