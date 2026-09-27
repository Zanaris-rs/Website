import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadClanOf, readClanOf } from "./page-data";

// `server-only` throws outside a React Server build; the test is the server.
vi.mock("server-only", () => ({}));

const answer = vi.hoisted(() => ({ rows: [] as unknown[], error: null as Error | null }));
vi.mock("@/lib/db", () => ({
  query: vi.fn(async () => {
    if (answer.error) throw answer.error;
    return answer.rows;
  }),
}));

beforeEach(() => {
  answer.rows = [];
  answer.error = null;
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
