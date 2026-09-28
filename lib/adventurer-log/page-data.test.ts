import { beforeEach, describe, expect, it, vi } from "vitest";

import { outfitsStatement } from "@/lib/outfits/queries";

import { loadLogPage } from "./page-data";
import { PART_BITS, PARTS_MASK_MAX } from "./parts";
import { personaStatement } from "./persona";
import { logStatement, pinnedStatement, timelineStatement } from "./queries";
import { recordsStatement } from "./records";

/**
 * Ruling C2's gate, wired: a part the owner hides is not read at all by the
 * log page (`readPart`), not merely left undrawn. The database is a stand-in
 * that answers the header row and an empty answer to everything else, and
 * keeps every statement it was asked to run.
 */

// `server-only` throws outside a React Server build; the test is the server.
vi.mock("server-only", () => ({}));
const ran = vi.hoisted(() => ({ texts: [] as string[], header: {} as Record<string, unknown> }));
vi.mock("@/lib/db", () => ({
  query: vi.fn(async (text: string) => {
    ran.texts.push(text);
    return text === "select * from accounts.adventure_log($1, $2)" ? [ran.header] : [];
  }),
}));
// No one's look from the game, and no clan: neither is a hideable part.
vi.mock("@/lib/outfits/looks", () => ({
  gameLooks: vi.fn(async () => new Map()),
  chatheadLooks: vi.fn(async () => new Map()),
}));
vi.mock("@/lib/clans/page-data", () => ({ loadClanOf: vi.fn(async () => null) }));

/** A header row as migration 18's adventure_log answers it, hiding `hiddenParts`. */
const header = (hiddenParts: number) => ({
  result: "ok", username: "hero", joined_at: "2026-09-01T00:00:00Z", about: "Cook, party host.", custom_css: "",
  css_disabled: false, hidden_categories: 0, is_owner: true, viewer_blocked: false, viewer_can_post: true,
  greeting: "Hi!", greeting_colour: 0, greeting_effect: 0, hidden_parts: hiddenParts,
});

/** The reads of the four hideable parts that are read on their own: each part's statement text. */
const PART_READS = {
  outfits: outfitsStatement("hero").text,
  records: recordsStatement("hero").text,
  pinned: pinnedStatement("hero", "hero").text,
  timeline: timelineStatement("hero", "hero", null, null).text,
};

beforeEach(() => {
  ran.texts.length = 0;
});

describe("loadLogPage, with parts hidden (ruling C2)", () => {
  it("reads none of a hidden part, and blanks About, for the owner too", async () => {
    ran.header = header(PARTS_MASK_MAX);
    const data = await loadLogPage("hero", "hero", null);
    expect(data.result).toBe("ok");
    if (data.result !== "ok") return;

    expect(ran.texts).toContain(logStatement("hero", "hero").text);
    for (const text of Object.values(PART_READS)) expect(ran.texts).not.toContain(text);
    expect(data.header.about).toBe("");
    expect(data.first).toBeNull();
    expect(data.pinned).toBeNull();
    expect(data.outfits).toEqual([]);
    expect(data.records).toEqual([]);
  });

  it("reads every part that is shown, and keeps About", async () => {
    ran.header = header(0);
    const data = await loadLogPage("hero", "hero", null);
    expect(data.result).toBe("ok");
    if (data.result !== "ok") return;

    for (const text of Object.values(PART_READS)) expect(ran.texts).toContain(text);
    expect(data.header.about).toBe("Cook, party host.");
    expect(data.first).toEqual({ entries: [], next: null, looks: {} });
  });

  // Each part alone: exactly its own reads are skipped. Dialogue is still
  // read (the figure says the pages overhead), and About comes in the header.
  it.each([
    ["dialogue", []],
    ["wardrobe", ["outfits"]],
    ["records", ["records"]],
    ["about", []],
    ["adventures", ["pinned", "timeline"]],
  ] as const)("hides %s by its own bit, and reads only the rest", async (part, skipped) => {
    ran.header = header(PART_BITS[part]);
    const data = await loadLogPage("hero", null, null);
    if (data.result !== "ok") throw new Error(data.result);

    for (const [read, text] of Object.entries(PART_READS)) {
      if ((skipped as readonly string[]).includes(read)) expect(ran.texts, read).not.toContain(text);
      else expect(ran.texts, read).toContain(text);
    }
    expect(ran.texts).toContain(personaStatement("hero").text);
    expect(data.header.about).toBe(part === "about" ? "" : "Cook, party host.");
  });
});
