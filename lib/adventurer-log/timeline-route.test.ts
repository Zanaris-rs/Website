import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/adventurer-log/[username]/timeline/route";

import { PART_BITS, PARTS_MASK_MAX } from "./parts";
import { logStatement, timelineStatement } from "./queries";
import { EMPTY_TIMELINE } from "./view";

/**
 * Ruling C2's gate on the one API that serves a hideable part: the timeline
 * route answers a log whose owner hides Adventures with `EMPTY_TIMELINE`,
 * and never runs the timeline read, for a visitor and for the owner alike.
 * (The route lives in `app/`; its test sits here, where vitest looks.)
 */

// `server-only` throws outside a React Server build; the test is the server.
vi.mock("server-only", () => ({}));
const db = vi.hoisted(() => ({
  texts: [] as string[],
  header: {} as Record<string, unknown>,
  viewer: null as string | null,
}));
vi.mock("@/lib/db", () => ({
  isConfigured: () => true,
  query: vi.fn(async (text: string) => {
    db.texts.push(text);
    return text === "select * from accounts.adventure_log($1, $2)" ? [db.header] : [];
  }),
}));
vi.mock("@/lib/account/session-server", () => ({
  readSession: vi.fn(async () => (db.viewer ? { u: db.viewer } : null)),
}));
vi.mock("@/lib/outfits/looks", () => ({ chatheadLooks: vi.fn(async () => new Map()) }));

const header = (hiddenParts: number) => ({
  result: "ok", username: "hero", joined_at: "2026-09-01T00:00:00Z", about: "", custom_css: "",
  css_disabled: false, hidden_categories: 0, is_owner: false, viewer_blocked: false, viewer_can_post: false,
  greeting: "", greeting_colour: 0, greeting_effect: 0, hidden_parts: hiddenParts,
});

/** The newest page, from a far-future cursor: without the gate, the whole timeline. */
async function newest() {
  const request = new NextRequest(
    "http://localhost/api/adventurer-log/hero/timeline?at=2100-01-01T00:00:00Z&rank=1&id=2147483647",
  );
  const response = await GET(request, { params: Promise.resolve({ username: "hero" }) } as Parameters<typeof GET>[1]);
  return { status: response.status, body: await response.json() };
}

const TIMELINE = timelineStatement("hero", null, null, null).text;

beforeEach(() => {
  db.texts.length = 0;
  db.viewer = null;
});

describe("GET /api/adventurer-log/<name>/timeline (ruling C2)", () => {
  it.each([
    ["a visitor", null],
    ["the owner", "hero"],
  ])("answers a log with Adventures hidden as an empty one to %s, and reads no timeline", async (_who, viewer) => {
    db.viewer = viewer;
    db.header = header(PART_BITS.adventures);
    expect(await newest()).toEqual({ status: 200, body: EMPTY_TIMELINE });
    expect(db.texts).toContain(logStatement("hero", viewer).text);
    expect(db.texts).not.toContain(TIMELINE);
  });

  it("reads the timeline when only other parts are hidden", async () => {
    db.header = header(PARTS_MASK_MAX & ~PART_BITS.adventures);
    expect(await newest()).toEqual({ status: 200, body: EMPTY_TIMELINE });
    expect(db.texts).toContain(TIMELINE);
  });

  it("reads the timeline of a log that is not there, as it always has", async () => {
    db.header = { result: "not_found" };
    expect((await newest()).status).toBe(200);
    expect(db.texts).toContain(TIMELINE);
  });
});
