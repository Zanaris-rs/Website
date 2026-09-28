import { describe, expect, it, vi } from "vitest";

import { loadCharacterPage } from "./character-data";
import { loadLogPage } from "./page-data";
import { PART_BITS, PARTS_MASK_MAX } from "./parts";
import { sheetOf, sheetSaveStatement } from "./persona-input";

/**
 * The Sheet's About is the one the owner stored, hidden or not. The log page
 * blanks a hidden About (ruling C2), but the Sheet starts its draft from
 * `loadCharacterPage`, and its one Save sends About back with everything
 * else: were About blanked there too, saving a title would wipe an About
 * the owner had only hidden. The database is a stand-in that answers the
 * header row, and nothing else.
 */

// `server-only` throws outside a React Server build; the test is the server.
vi.mock("server-only", () => ({}));
const stored = vi.hoisted(() => ({ header: {} as Record<string, unknown> }));
vi.mock("@/lib/db", () => ({
  query: vi.fn(async (text: string) => (text === "select * from accounts.adventure_log($1, $2)" ? [stored.header] : [])),
}));
// Signed in as the owner, whose account loads.
vi.mock("@/lib/account/session-server", () => ({ requireSession: vi.fn(async () => ({ u: "hero" })) }));
vi.mock("@/lib/account/profile-server", () => ({
  loadAccount: vi.fn(async () => ({ status: "ok", profile: { username: "hero" } })),
}));
// No one's look from the game, and no clan: neither has anything to do with About.
vi.mock("@/lib/outfits/looks", () => ({
  gameLooks: vi.fn(async () => new Map()),
  chatheadLooks: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/clans/page-data", () => ({ loadClanOf: vi.fn(async () => null) }));

const ABOUT = "Cook, party host.";

/** A header row as migration 18's adventure_log answers it, hiding `hiddenParts`. */
const header = (hiddenParts: number) => ({
  result: "ok", username: "hero", joined_at: "2026-09-01T00:00:00Z", about: ABOUT, custom_css: "",
  css_disabled: false, hidden_categories: 0, is_owner: true, viewer_blocked: false, viewer_can_post: true,
  greeting: "Hi!", greeting_colour: 0, greeting_effect: 0, hidden_parts: hiddenParts,
});

describe("loadCharacterPage, with About hidden", () => {
  it.each([
    ["About alone", PART_BITS.about],
    ["every part", PARTS_MASK_MAX],
  ])("hands the Sheet the stored About, and its Save sends it back (%s hidden)", async (_, hidden) => {
    stored.header = header(hidden);
    const page = await loadCharacterPage();
    expect(page.status).toBe("ok");
    if (page.status !== "ok") return;

    expect(page.data.header.hiddenParts & PART_BITS.about).toBe(PART_BITS.about);
    expect(page.data.header.about).toBe(ABOUT);
    // The Sheet's draft as its page makes it, and the statement its Save runs.
    const draft = sheetOf(page.data.persona, page.data.header.about);
    expect(draft.about).toBe(ABOUT);
    expect(sheetSaveStatement("hero", draft).values).toContain(ABOUT);
  });

  it("where the log page, reading the same header, blanks it", async () => {
    stored.header = header(PART_BITS.about);
    const log = await loadLogPage("hero", "hero", null);
    expect(log.result).toBe("ok");
    if (log.result !== "ok") return;
    expect(log.header.about).toBe("");
  });
});
