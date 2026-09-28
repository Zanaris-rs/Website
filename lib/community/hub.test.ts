import { beforeEach, describe, expect, it, vi } from "vitest";

import { query } from "@/lib/db";

import { loadHub, loadSquare, loadYourLook } from "./hub";

// `server-only` throws outside a React Server build; the test is the server.
vi.mock("server-only", () => ({}));

/** Answers by statement; a key's Error is thrown instead. */
const answer = vi.hoisted(() => ({ by: null as ((text: string, values: readonly unknown[]) => unknown[]) | null }));
vi.mock("@/lib/db", () => ({
  query: vi.fn(async (text: string, values: readonly unknown[] = []) => {
    if (!answer.by) throw new Error("no answers set");
    return answer.by(text, values);
  }),
}));

beforeEach(() => {
  answer.by = null;
  vi.mocked(query).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const LOOK = {
  gender: 0,
  kits: [0, 10, 18, 26, 33, 36, 42],
  colours: [0, 0, 0, 0, 0],
  worn: [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1],
};

/** A directory row as 018's `adventure_log_directory` answers it: an update, newest first. */
const logRow = (username: string, minute: number, greeting = "", colour = 0, effect = 0) => ({
  username,
  greeting,
  greeting_colour: colour,
  greeting_effect: effect,
  last_at: `2026-09-28T10:${String(59 - minute).padStart(2, "0")}:00.000Z`,
  last_kind: "update",
  last_category: null,
  last_body: `${username} was here`,
});

const LOGS = [
  logRow("nel", 0, "Selling lobbies 250 ea", 9, 1),
  logRow("no_outfit", 1, "Nobody sees me"),
  logRow("zezima", 2, "Welcome to my log, traveller!"),
  logRow("mutey", 3),
  logRow("kitty_kat", 4, "Ho ho ho!", 6, 2),
  logRow("pure_pete", 5, "Buying gf"),
  logRow("wizzy_wes", 6, "Anyone seen Sedridor?"),
];
const OUTFITS = ["nel", "zezima", "mutey", "kitty_kat", "pure_pete", "wizzy_wes"].map((username) => ({ username, ...LOOK }));

/** All seven combat skills on the hiscores: combat 48. */
const EXACT = [0, 1, 2, 3, 4, 5, 6, 7].map((category) => ({
  category,
  username: "",
  account_id: 1,
  level: category === 0 ? 300 : category >= 5 ? 20 : 40,
  value: 1000,
  rank: 1,
}));

const TOP = Array.from({ length: 21 }, (_, i) => ({ rank: i + 1, username: `p${i + 1}`, level: 500 - i, value: 1000 }));
const CLANS = ["Varrock Knights", "Lumbridge Lads", "The Partyhat Society", "Draynor Dodgers"].map((name, i) => ({
  name,
  slug: name.toLowerCase().replaceAll(" ", "-"),
  motto: "",
  crest: 1187,
  members: 4 - i,
  created_at: "2026-09-27T10:00:00.000Z",
}));

type Answers = Partial<Record<"directory" | "outfits" | "game" | "player" | "table" | "records" | "clans", unknown>>;

/** The site's reads, told apart by their text. */
function answers(given: Answers = {}) {
  const all: Required<Answers> = {
    directory: (limit: number) => LOGS.slice(0, limit + 1),
    outfits: (names: string[]) => OUTFITS.filter((row) => names.includes(row.username)),
    game: [],
    player: (username: string) => (username === "zezima" ? EXACT.map((row) => ({ ...row, username })) : []),
    table: TOP,
    records: (seconds: number) =>
      seconds === 21600
        ? []
        : [{ rank: 1, username: "nel", gained: 12400, elapsed_ms: 1000, achieved_at: "2026-09-28T09:00:00.000Z" }],
    clans: CLANS,
    ...given,
  };
  answer.by = (text, values) => {
    const key: keyof Answers | null = text.includes("adventure_log_directory(")
      ? "directory"
      : text.includes("outfit_default_looks(")
        ? "outfits"
        : text.includes("outfit_import_look(")
          ? "game"
          : text.includes("union all")
            ? "player"
            : text.includes("with ranked")
              ? "table"
              : text.includes("record_board(")
                ? "records"
                : text.includes("clan_directory(")
                  ? "clans"
                  : null;
    if (key === null) throw new Error(`unexpected statement: ${text}`);
    const rows = all[key];
    if (rows instanceof Error) throw rows;
    if (typeof rows !== "function") return rows as unknown[];
    const first =
      key === "directory" ? values[2] : key === "outfits" || key === "game" ? values[0] : key === "player" ? values[1] : values[0];
    return (rows as (arg: unknown) => unknown[])(first);
  };
}

const statements = () => vi.mocked(query).mock.calls.map(([text, values]) => ({ text, values }));

describe("loadSquare", () => {
  it("stands the five most recent with a saved outfit, most recent first, each with their greeting and level", async () => {
    answers();
    const sitters = await loadSquare();
    expect(sitters.map((sitter) => sitter.username)).toEqual(["nel", "zezima", "mutey", "kitty_kat", "pure_pete"]);
    expect(sitters[0]).toEqual({
      username: "nel",
      name: "Nel",
      look: LOOK,
      greeting: "Selling lobbies 250 ea",
      greetingColour: 9,
      greetingEffect: 1,
      combat: null,
    });
    expect(sitters[1].combat).toBe(48);
    expect(sitters[2].greeting).toBe("");
  });

  it("reads the directory's ten most recent and their saved outfits, and never a look from the game", async () => {
    answers();
    await loadSquare();
    const read = statements();
    expect(read[0]).toEqual({ text: "select * from accounts.adventure_log_directory($1, $2, $3)", values: [null, null, 10] });
    expect(read[1]).toEqual({
      text: "select * from accounts.outfit_default_looks($1::text[])",
      values: [LOGS.map((row) => row.username)],
    });
    expect(read.slice(2).every(({ text }) => text.includes("union all"))).toBe(true);
    expect(read).toHaveLength(2 + 5);
    expect(read.some(({ text }) => text.includes("outfit_import_look"))).toBe(false);
  });

  it("stands nobody when nobody is about, without reading outfits", async () => {
    answers({ directory: [] });
    expect(await loadSquare()).toEqual([]);
    expect(statements()).toHaveLength(1);
  });

  it("forgives a failed level: logged, and no level shown", async () => {
    answers({ player: new Error("connection refused") });
    const sitters = await loadSquare();
    expect(sitters.map((sitter) => sitter.combat)).toEqual([null, null, null, null, null]);
    expect(console.error).toHaveBeenCalledWith("[community] a sitter's hiscores read failed", expect.any(Error));
  });

  it("throws when the directory or the outfits read fails, for the hub to catch", async () => {
    answers({ outfits: new Error("connection refused") });
    await expect(loadSquare()).rejects.toThrow("connection refused");
    answers({ directory: [{ ...LOGS[0], greeting_colour: "red" }] });
    await expect(loadSquare()).rejects.toThrow(/greeting_colour/);
  });
});

describe("loadHub", () => {
  it("fills every box", async () => {
    answers();
    const hub = await loadHub();
    expect(hub.square.ok && hub.square.value).toHaveLength(5);
    expect(hub.top).toEqual({
      ok: true,
      value: [1, 2, 3, 4, 5].map((rank) => ({
        rank,
        username: `p${rank}`,
        name: `P${rank}`,
        totalLevel: 501 - rank,
        look: null,
      })),
    });
    expect(hub.records).toEqual({
      ok: true,
      value: [
        { label: "5 minutes", seconds: 300, holder: { username: "nel", name: "Nel", xp: 1240 } },
        { label: "6 hours", seconds: 21600, holder: null },
        { label: "24 hours", seconds: 86400, holder: { username: "nel", name: "Nel", xp: 1240 } },
      ],
    });
    expect(hub.recent.ok && hub.recent.value.map((entry) => entry.username)).toEqual(
      LOGS.slice(0, 5).map((row) => row.username),
    );
    expect(hub.clans.ok && hub.clans.value.map((clan) => clan.name)).toEqual([
      "Varrock Knights",
      "Lumbridge Lads",
      "The Partyhat Society",
    ]);
  });

  it("reads the Overall top selection and each duration's Overall board, one row each", async () => {
    answers();
    await loadHub();
    const read = statements();
    const table = read.find(({ text }) => text.includes("with ranked"))!;
    expect(table.values).toEqual(["main", 0, 1, 21]);
    expect(read.filter(({ text }) => text.includes("record_board(")).map(({ values }) => values)).toEqual([
      [300, 0, 1],
      [21600, 0, 1],
      [86400, 0, 1],
    ]);
  });

  it("fails a box on its own: the rest still fill", async () => {
    answers({ records: new Error("connection refused") });
    const hub = await loadHub();
    expect(hub.records).toEqual({ ok: false });
    expect(hub.square.ok && hub.top.ok && hub.recent.ok && hub.clans.ok).toBe(true);
    expect(console.error).toHaveBeenCalledWith("[community] record holders read failed", expect.any(Error));

    answers({ clans: new Error("connection refused"), table: new Error("connection refused") });
    const again = await loadHub();
    expect(again.clans).toEqual({ ok: false });
    expect(again.top).toEqual({ ok: false });
    expect(again.records.ok && again.square.ok && again.recent.ok).toBe(true);
  });

  it("fails the square when the outfits read fails, and Recent activity with it, as /adventurers would", async () => {
    answers({ outfits: new Error("connection refused") });
    const hub = await loadHub();
    expect(hub.square).toEqual({ ok: false });
    // The directory's chatheads read the same outfits, and are not forgiving there.
    expect(hub.recent).toEqual({ ok: false });
    // Top of the hiscores' chatheads are a nicety: empty frames.
    expect(hub.top.ok && hub.top.value.every((row) => row.look === null)).toBe(true);
    expect(hub.records.ok && hub.clans.ok).toBe(true);
  });
});

describe("loadYourLook", () => {
  it("is the reader's chathead look, or null, forgivingly", async () => {
    answers();
    expect(await loadYourLook("zezima")).toEqual(LOOK);
    answers({ outfits: [], game: [] });
    expect(await loadYourLook("staffy")).toBeNull();
    answers({ outfits: new Error("connection refused") });
    expect(await loadYourLook("zezima")).toBeNull();
    expect(console.error).toHaveBeenCalledWith("[community] chatheads read failed", expect.any(Error));
  });
});
