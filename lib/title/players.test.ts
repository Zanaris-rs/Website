import { describe, expect, it } from "vitest";

import type { WorldInfo } from "@/lib/worlds";

import { COUNT_TIMEOUT_MS, playingSentence, sumPlayers } from "./players";

function ok(players: number): PromiseSettledResult<WorldInfo> {
  return {
    status: "fulfilled",
    value: { id: 1, members: true, players, maxPlayers: 150 },
  };
}

function failed(): PromiseSettledResult<WorldInfo> {
  return { status: "rejected", reason: new Error("offline") };
}

describe("sumPlayers", () => {
  it("adds up the worlds that answered", () => {
    expect(sumPlayers([ok(3), ok(11), ok(0)])).toBe(14);
  });

  it("counts a world that failed as zero rather than losing the total", () => {
    expect(sumPlayers([ok(3), failed(), ok(4)])).toBe(7);
  });

  it("is zero when nothing answered", () => {
    expect(sumPlayers([failed(), failed()])).toBe(0);
    expect(sumPlayers([])).toBe(0);
  });
});

describe("playingSentence", () => {
  it("uses 2004's own grammar", () => {
    expect(playingSentence(0)).toBe("There are currently 0 people playing!");
    expect(playingSentence(1)).toBe("There is currently 1 person playing!");
    expect(playingSentence(2)).toBe("There are currently 2 people playing!");
  });
});

describe("COUNT_TIMEOUT_MS", () => {
  it("is short enough that a dead world cannot hold up a revalidation", () => {
    expect(COUNT_TIMEOUT_MS).toBe(2000);
  });
});
