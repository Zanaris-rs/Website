import { describe, expect, it, vi } from "vitest";

import { EMPTY_TIMELINE, loadTimeline } from "./view";

// `server-only` throws outside a React Server build; the test is the server.
vi.mock("server-only", () => ({}));
// A log with no adventures: the timeline read answers no rows, and no one's look is wanted.
vi.mock("@/lib/db", () => ({ query: vi.fn(async () => []) }));
vi.mock("@/lib/outfits/looks", () => ({ chatheadLooks: vi.fn(async () => new Map()) }));

describe("EMPTY_TIMELINE", () => {
  it("is exactly what a log with no adventures answers, so a hidden timeline reads as an empty one", async () => {
    expect(await loadTimeline("zezima", null, null, null)).toEqual(EMPTY_TIMELINE);
    expect(EMPTY_TIMELINE).toEqual({ entries: [], next: null, looks: {} });
  });
});
