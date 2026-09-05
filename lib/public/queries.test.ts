import { describe, expect, it } from "vitest";

import {
  BANS_PAGE_SIZE,
  ECONOMY_DAYS,
  parseFlow,
  parseFlows,
  parsePunishment,
  parsePunishmentPage,
  parseSnapshot,
  parseSnapshots,
  parseStaffSpawn,
  parseStaffSpawns,
  publicEconomyFlowStatement,
  publicEconomyStatement,
  publicPunishmentsStatement,
  publicStaffSpawnsStatement,
} from "./queries";

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

describe("the statements", () => {
  it("call the four public functions and nothing else", () => {
    const calls = [
      publicPunishmentsStatement(1),
      publicEconomyStatement(),
      publicEconomyFlowStatement(),
      publicStaffSpawnsStatement(),
    ];

    expect(calls.map((call) => squash(call.text))).toEqual([
      "select * from accounts.public_punishments($1, $2)",
      "select * from accounts.public_economy($1)",
      "select * from accounts.public_economy_flow($1)",
      "select * from accounts.public_staff_spawns($1)",
    ]);
  });

  it("never interpolates a value", () => {
    const calls = [
      publicPunishmentsStatement(7),
      publicPunishmentsStatement(-3),
      publicEconomyStatement(90),
      publicEconomyFlowStatement(1),
      publicStaffSpawnsStatement(0),
    ];

    for (const call of calls) {
      // Every argument is a placeholder, so no digit from an argument can
      // reach the text. The `$n` markers are the only numbers in it.
      expect(call.text.replace(/\$\d/g, "")).not.toMatch(/\d/);
    }
  });

  it("asks for one row more than a page shows, and offsets by whole pages", () => {
    expect(publicPunishmentsStatement(1).values).toEqual([
      BANS_PAGE_SIZE + 1,
      0,
    ]);
    expect(publicPunishmentsStatement(3).values).toEqual([
      BANS_PAGE_SIZE + 1,
      BANS_PAGE_SIZE * 2,
    ]);
    expect(publicPunishmentsStatement(2, 5).values).toEqual([6, 5]);
  });

  it("treats a nonsense page as the first one", () => {
    for (const page of [0, -1, 1.5, Number.NaN]) {
      expect(publicPunishmentsStatement(page).values).toEqual([
        BANS_PAGE_SIZE + 1,
        0,
      ]);
    }
  });

  it("asks the three economy functions for the same window", () => {
    expect(publicEconomyStatement().values).toEqual([ECONOMY_DAYS]);
    expect(publicEconomyFlowStatement().values).toEqual([ECONOMY_DAYS]);
    expect(publicStaffSpawnsStatement().values).toEqual([ECONOMY_DAYS]);
  });
});

describe("parsePunishment", () => {
  const row = {
    username: "the_inducted",
    kind: "ban",
    issued_at: new Date("2026-09-01T10:00:00Z"),
    until: new Date("2026-09-08T10:00:00Z"),
    automated: false,
    note: "Botting at the yews.",
    lifted_at: null,
  };

  it("reads a row", () => {
    expect(parsePunishment(row)).toEqual({
      username: "the_inducted",
      kind: "ban",
      issuedAt: "2026-09-01T10:00:00.000Z",
      until: "2026-09-08T10:00:00.000Z",
      automated: false,
      note: "Botting at the yews.",
      liftedAt: null,
    });
  });

  it("reads a permanent, automated, unlifted mute with no note", () => {
    expect(
      parsePunishment({
        username: "someone",
        kind: "mute",
        issued_at: "2026-09-01T10:00:00Z",
        until: null,
        automated: true,
        note: null,
        lifted_at: null,
      }),
    ).toEqual({
      username: "someone",
      kind: "mute",
      issuedAt: "2026-09-01T10:00:00.000Z",
      until: null,
      automated: true,
      note: "",
      liftedAt: null,
    });
  });

  it("drops a row with no name or an unknown kind", () => {
    expect(parsePunishment({ ...row, username: "" })).toBeNull();
    expect(parsePunishment({ ...row, kind: "jail" })).toBeNull();
    expect(parsePunishment(null)).toBeNull();
    expect(parsePunishment("ban")).toBeNull();
  });

  it("never carries an issuer, whatever the row holds", () => {
    const parsed = parsePunishment({
      ...row,
      issued_by_account_id: 4,
      issued_by: "mod_matt",
    });
    expect(JSON.stringify(parsed)).not.toContain("mod_matt");
    expect(Object.keys(parsed ?? {})).toEqual([
      "username",
      "kind",
      "issuedAt",
      "until",
      "automated",
      "note",
      "liftedAt",
    ]);
  });
});

describe("parsePunishmentPage", () => {
  const rows = Array.from({ length: BANS_PAGE_SIZE + 1 }, (_, i) => ({
    username: `player_${i}`,
    kind: "ban",
    issued_at: "2026-09-01T10:00:00Z",
    until: null,
    automated: false,
    note: "",
    lifted_at: null,
  }));

  it("shows a page and knows there is another", () => {
    const page = parsePunishmentPage(rows, 1);
    expect(page.items).toHaveLength(BANS_PAGE_SIZE);
    expect(page.page).toBe(1);
    expect(page.prevPage).toBeNull();
    expect(page.nextPage).toBe(2);
  });

  it("knows the last page is the last", () => {
    const page = parsePunishmentPage(rows.slice(0, BANS_PAGE_SIZE), 4);
    expect(page.nextPage).toBeNull();
    expect(page.prevPage).toBe(3);
  });

  it("renders an empty record as an empty page, not an error", () => {
    const page = parsePunishmentPage([], 1);
    expect(page.items).toEqual([]);
    expect(page.prevPage).toBeNull();
    expect(page.nextPage).toBeNull();
  });

  it("keeps the next arrow when a row is unreadable", () => {
    const page = parsePunishmentPage([{ username: "" }, ...rows], 1);
    expect(page.items).toHaveLength(BANS_PAGE_SIZE - 1);
    expect(page.nextPage).toBe(2);
  });
});

describe("parseSnapshot", () => {
  it("reads a census row, tracked items included", () => {
    expect(
      parseSnapshot({
        taken_at: "2026-09-05T11:00:00Z",
        players: 143,
        coins: 41_233_119,
        tracked: { "1038": 2, "1050": 11, "962": 0 },
      }),
    ).toEqual({
      takenAt: "2026-09-05T11:00:00.000Z",
      players: 143,
      coins: 41_233_119,
      tracked: [
        { id: 1050, count: 11 },
        { id: 1038, count: 2 },
        { id: 962, count: 0 },
      ],
    });
  });

  it("reads a bigint that arrived as text", () => {
    const snapshot = parseSnapshot({
      taken_at: "2026-09-05T11:00:00Z",
      players: "143",
      coins: "9007199254740",
      tracked: {},
    });
    expect(snapshot?.coins).toBe(9_007_199_254_740);
    expect(snapshot?.players).toBe(143);
  });

  it("reads tracked items that came back as a list or as text", () => {
    const asList = parseSnapshot({
      taken_at: "2026-09-05T11:00:00Z",
      players: 1,
      coins: 1,
      tracked: [{ id: 1038, count: 2 }],
    });
    expect(asList?.tracked).toEqual([{ id: 1038, count: 2 }]);

    const asText = parseSnapshot({
      taken_at: "2026-09-05T11:00:00Z",
      players: 1,
      coins: 1,
      tracked: '{"1038": 2}',
    });
    expect(asText?.tracked).toEqual([{ id: 1038, count: 2 }]);
  });

  it("survives a total it cannot read rather than printing NaN", () => {
    const snapshot = parseSnapshot({
      taken_at: "2026-09-05T11:00:00Z",
      players: null,
      coins: "not a number",
      tracked: "{oops",
    });
    expect(snapshot).toEqual({
      takenAt: "2026-09-05T11:00:00.000Z",
      players: null,
      coins: null,
      tracked: [],
    });
  });

  it("drops a row with no timestamp", () => {
    expect(parseSnapshot({ players: 1, coins: 1 })).toBeNull();
  });

  it("orders a series oldest first", () => {
    const series = parseSnapshots([
      { taken_at: "2026-09-05T12:00:00Z", players: 2, coins: 2, tracked: {} },
      { taken_at: "2026-09-05T10:00:00Z", players: 1, coins: 1, tracked: {} },
      { nonsense: true },
    ]);
    expect(series.map((s) => s.players)).toEqual([1, 2]);
  });
});

describe("parseFlow", () => {
  it("reads a movement", () => {
    expect(
      parseFlow({ taken_at: "2026-09-05T11:00:00Z", item_id: 1038, delta: -1 }),
    ).toEqual({
      takenAt: "2026-09-05T11:00:00.000Z",
      itemId: 1038,
      delta: -1,
    });
  });

  it("drops a row with no item or no delta", () => {
    expect(parseFlow({ taken_at: "2026-09-05T11:00:00Z", delta: 1 })).toBeNull();
    expect(parseFlow({ item_id: 1038 })).toBeNull();
    expect(parseFlows([null, { item_id: 1038, delta: 1 }])).toHaveLength(1);
  });
});

describe("parseStaffSpawn", () => {
  it("reads a spawn, with no name anywhere in it", () => {
    const spawn = parseStaffSpawn({
      created_at: "2026-09-05T11:00:00Z",
      item_id: 995,
      count: 1000,
      world: 1,
      staff_account_id: 4,
    });
    expect(spawn).toEqual({
      createdAt: "2026-09-05T11:00:00.000Z",
      itemId: 995,
      count: 1000,
      world: 1,
    });
    expect(Object.keys(spawn ?? {})).toEqual([
      "createdAt",
      "itemId",
      "count",
      "world",
    ]);
  });

  it("reads a row with no world", () => {
    expect(
      parseStaffSpawn({ created_at: null, item_id: 995, count: 1, world: null }),
    ).toEqual({ createdAt: null, itemId: 995, count: 1, world: null });
  });

  it("drops a row with no item", () => {
    expect(parseStaffSpawn({ created_at: null, count: 1 })).toBeNull();
    expect(parseStaffSpawns([{}, { item_id: 1, count: 1 }])).toHaveLength(1);
  });
});
