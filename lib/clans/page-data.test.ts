import { beforeEach, describe, expect, it, vi } from "vitest";

import { query } from "@/lib/db";

import { loadClanOf, loadPhotoSitters, readClanOf } from "./page-data";
import type { ClanMember } from "./queries";

// `server-only` throws outside a React Server build; the test is the server.
vi.mock("server-only", () => ({}));

const answer = vi.hoisted(() => ({
  rows: [] as unknown[],
  error: null as Error | null,
  /** Answers by statement, for a load that reads more than one thing. */
  by: null as ((text: string) => unknown[]) | null,
}));
vi.mock("@/lib/db", () => ({
  query: vi.fn(async (text: string) => {
    if (answer.by) return answer.by(text);
    if (answer.error) throw answer.error;
    return answer.rows;
  }),
}));

beforeEach(() => {
  answer.rows = [];
  answer.error = null;
  answer.by = null;
  vi.mocked(query).mockClear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const ROW = { clan_id: 1, name: "Varrock Knights", slug: "varrock-knights", rank: "leader" };
const CLAN = { clanId: 1, name: "Varrock Knights", slug: "varrock-knights", rank: "leader" };

describe("readClanOf", () => {
  it("reads a player's clan, or null for none", async () => {
    answer.rows = [ROW];
    expect(await readClanOf("zezima")).toEqual(CLAN);
    answer.rows = [];
    expect(await readClanOf("staffy")).toBeNull();
  });

  it("throws when the read fails, so a page can tell a failure from no clan", async () => {
    answer.error = new Error("connection refused");
    await expect(readClanOf("zezima")).rejects.toThrow("connection refused");
    answer.error = null;
    answer.rows = [{ ...ROW, rank: "owner" }];
    await expect(readClanOf("zezima")).rejects.toThrow();
  });
});

describe("loadClanOf", () => {
  it("is the same read, forgiving: a failure reads as no clan", async () => {
    answer.rows = [ROW];
    expect(await loadClanOf("zezima")).toEqual(CLAN);
    answer.error = new Error("connection refused");
    expect(await loadClanOf("zezima")).toBeNull();
  });
});

describe("loadPhotoSitters", () => {
  const LOOK = {
    gender: 0,
    kits: [0, 10, 18, 26, 33, 36, 42],
    colours: [0, 0, 0, 0, 0],
    worn: [1163, -1, -1, -1, 1127, -1, -1, -1, -1, -1, -1, -1, -1, -1],
  };
  const PERSONA = {
    title: "", examine: "", hangout: "", goals: [], god: null,
    home_town: null, scene: "draynor", facing: 0, signature_emote: null, dialogue: [],
  };
  const member = (username: string, rank: ClanMember["rank"]): ClanMember => ({
    username,
    rank,
    joinedAt: "2026-09-27T10:39:49.142Z",
  });
  const ROSTER = [member("zezima", "leader"), member("nel", "captain"), member("mutey", "recruit")];

  /** Answers the persona read and the outfits read, or throws for either. */
  function answers({
    persona = [PERSONA] as unknown[] | Error,
    outfits = [] as unknown[] | Error,
  }) {
    answer.by = (text) => {
      const rows = text.includes("adventure_persona(") ? persona : text.includes("outfit_default_looks(") ? outfits : null;
      if (rows === null) throw new Error(`unexpected statement: ${text}`);
      if (rows instanceof Error) throw rows;
      return rows;
    };
  }
  const statements = () => vi.mocked(query).mock.calls.map(([text, values]) => ({ text, values }));

  it("stands every member with a saved outfit, in the roster's order, in the Leader's scene", async () => {
    answers({ outfits: [{ username: "mutey", ...LOOK, gender: 1 }, { username: "zezima", ...LOOK }] });
    expect(await loadPhotoSitters("zezima", ROSTER)).toEqual({
      leaderScene: "draynor",
      sitters: [
        { username: "zezima", rank: "leader", look: LOOK },
        { username: "mutey", rank: "recruit", look: { ...LOOK, gender: 1 } },
      ],
    });
    expect(statements()).toEqual([
      { text: "select * from accounts.adventure_persona($1)", values: ["zezima"] },
      { text: "select * from accounts.outfit_default_looks($1::text[])", values: [["zezima", "nel", "mutey"]] },
    ]);
  });

  it("never falls back to a look from the game: a member with no saved outfit is left out", async () => {
    answers({ outfits: [] });
    expect(await loadPhotoSitters("zezima", ROSTER)).toEqual({ leaderScene: "draynor", sitters: [] });
    expect(statements().some(({ text }) => text.includes("outfit_import_look"))).toBe(false);
  });

  it("reads no scene for a Leader with no persona, or no Leader", async () => {
    answers({ persona: [], outfits: [{ username: "nel", ...LOOK }] });
    expect(await loadPhotoSitters("zezima", ROSTER)).toEqual({
      leaderScene: null,
      sitters: [{ username: "nel", rank: "captain", look: LOOK }],
    });

    vi.mocked(query).mockClear();
    expect((await loadPhotoSitters(null, ROSTER)).leaderScene).toBeNull();
    expect(statements().map(({ text }) => text)).toEqual(["select * from accounts.outfit_default_looks($1::text[])"]);
  });

  it("forgives a failed persona read: logged, and no scene", async () => {
    answers({ persona: new Error("connection refused"), outfits: [{ username: "zezima", ...LOOK }] });
    expect(await loadPhotoSitters("zezima", ROSTER)).toEqual({
      leaderScene: null,
      sitters: [{ username: "zezima", rank: "leader", look: LOOK }],
    });
    expect(console.error).toHaveBeenCalledWith("[clans] the Leader's persona read failed", expect.any(Error));
  });

  it("throws when the outfits read fails, or answers what it cannot read, for the page to catch", async () => {
    answers({ outfits: new Error("connection refused") });
    await expect(loadPhotoSitters("zezima", ROSTER)).rejects.toThrow("connection refused");
    answers({ outfits: [{ username: "zezima", ...LOOK, worn: [1] }] });
    await expect(loadPhotoSitters("zezima", ROSTER)).rejects.toThrow(/worn/);
  });

  it("reads no outfits for an empty roster", async () => {
    answers({});
    expect(await loadPhotoSitters("zezima", [])).toEqual({ leaderScene: "draynor", sitters: [] });
    expect(statements().map(({ text }) => text)).toEqual(["select * from accounts.adventure_persona($1)"]);
  });
});
