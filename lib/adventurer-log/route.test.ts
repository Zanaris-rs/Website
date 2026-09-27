import { beforeEach, describe, expect, it, vi } from "vitest";

import { CLAN_ANSWERS, clanLeaveStatement } from "@/lib/clans/queries";

import { runWrite } from "./route";
import { logSaveStatement } from "./queries";

// `server-only` throws outside a React Server build; the test is the server.
vi.mock("server-only", () => ({}));
// The session helpers read cookies through `next/headers`; runWrite never calls them.
vi.mock("@/lib/account/session-server", () => ({ requireLiveSession: vi.fn() }));
vi.mock("@/lib/account/origin", () => ({ assertSameOrigin: vi.fn() }));

const answer = vi.hoisted(() => ({ rows: [] as unknown[], error: null as Error | null }));
vi.mock("@/lib/db", () => ({
  isConfigured: () => true,
  query: vi.fn(async () => {
    if (answer.error) throw answer.error;
    return answer.rows;
  }),
}));

async function answered(response: Response): Promise<[number, unknown]> {
  return [response.status, await response.json()];
}

beforeEach(() => {
  answer.rows = [];
  answer.error = null;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("runWrite", () => {
  it("reads a log write's answer as it always has, with two arguments", async () => {
    const statement = logSaveStatement("zezima", "", "");
    answer.rows = [{ result: "ok" }];
    expect(await answered(await runWrite(statement, "adventure_log_save"))).toEqual([200, { ok: true }]);
    answer.rows = [{ result: "muted" }];
    expect(await answered(await runWrite(statement, "adventure_log_save"))).toEqual([403, { error: "muted" }]);
    answer.rows = [{ result: "rate_limited" }];
    expect(await answered(await runWrite(statement, "adventure_log_save"))).toEqual([429, { error: "rate_limited" }]);
  });

  it("treats a clan code as undocumented for a log write", async () => {
    answer.rows = [{ result: "not_member" }];
    const response = await runWrite(logSaveStatement("zezima", "", ""), "adventure_log_save");
    expect(await answered(response)).toEqual([503, { error: "unavailable" }]);
  });

  it("reads a clan write's answer with the answers it is given", async () => {
    const statement = clanLeaveStatement("zezima");
    for (const [result, status] of [
      ["ok", 200],
      ["not_member", 403],
      ["leader", 403],
      ["no_invite", 404],
      ["taken", 409],
      ["bad_perm", 400],
      ["rate_limited", 429],
    ] as const) {
      answer.rows = [{ result }];
      const body = result === "ok" ? { ok: true } : { error: result };
      expect(await answered(await runWrite(statement, "clan_leave", CLAN_ANSWERS))).toEqual([status, body]);
    }
  });

  it("answers 503 for an answer nobody documented, no row, or a failed query", async () => {
    const statement = clanLeaveStatement("zezima");
    answer.rows = [{ result: "maybe" }];
    expect(await answered(await runWrite(statement, "clan_leave", CLAN_ANSWERS))).toEqual([503, { error: "unavailable" }]);
    answer.rows = [];
    expect(await answered(await runWrite(statement, "clan_leave", CLAN_ANSWERS))).toEqual([503, { error: "unavailable" }]);
    answer.error = new Error("connection refused");
    expect(await answered(await runWrite(statement, "clan_leave", CLAN_ANSWERS))).toEqual([503, { error: "unavailable" }]);
  });

  it("never lets a response be cached", async () => {
    answer.rows = [{ result: "ok" }];
    const response = await runWrite(clanLeaveStatement("zezima"), "clan_leave", CLAN_ANSWERS);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
