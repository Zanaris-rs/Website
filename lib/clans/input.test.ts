import { describe, expect, it } from "vitest";

import { checkAnswerInput, checkClanFields, checkNoticeInput, checkPermsInput } from "./input";
import { CLAN_WORLDS } from "./worlds";

const GOOD = { name: "  Varrock Knights ", motto: " For the King! ", crest: 1333, world: null, about: " We guard Varrock.\n" };

describe("checkClanFields", () => {
  it("trims, and keeps what the database will take", () => {
    expect(checkClanFields(GOOD, "page")).toEqual({
      ok: true,
      value: { name: "Varrock Knights", motto: "For the King!", crest: 1333, world: null, about: "We guard Varrock." },
    });
    expect(checkClanFields(GOOD, "create")).toEqual({
      ok: true,
      value: { name: "Varrock Knights", motto: "For the King!", crest: 1333, world: null, about: "" },
    });
    expect(checkClanFields({ ...GOOD, world: CLAN_WORLDS[0].id, motto: undefined }, "create")).toMatchObject({
      ok: true,
      value: { motto: "", world: CLAN_WORLDS[0].id },
    });
  });

  it.each([
    ["no body", null, "bad_request"],
    ["two spaces in the name", { ...GOOD, name: "Varrock  Knights" }, "bad_name"],
    ["a name staff keep", { ...GOOD, name: "Clan 12" }, "bad_name"],
    ["a note for a crest", { ...GOOD, crest: 1334 }, "bad_crest"],
    ["an item with no icon", { ...GOOD, crest: 798 }, "bad_crest"],
    ["a placeholder with an icon but no name", { ...GOOD, crest: 599 }, "bad_crest"],
    ["a crest that is text", { ...GOOD, crest: "1333" }, "bad_crest"],
    ["a world the site does not list", { ...GOOD, world: 255 }, "bad_world"],
  ])("refuses %s at the start with the database's own code", (_what, raw, error) => {
    expect(checkClanFields(raw as Record<string, unknown> | null, "create")).toEqual({ ok: false, error });
  });

  it("leaves a staff name like Clan 12 to the database on a page save, which keeps it only unchanged", () => {
    expect(checkClanFields({ ...GOOD, name: "Clan 12" }, "page")).toMatchObject({ ok: true, value: { name: "Clan 12" } });
    expect(checkClanFields({ ...GOOD, name: "clan 7" }, "page")).toMatchObject({ ok: true, value: { name: "clan 7" } });
    // The shape still applies to a page save.
    expect(checkClanFields({ ...GOOD, name: "Varrock  Knights" }, "page")).toEqual({ ok: false, error: "bad_name" });
    expect(checkClanFields({ ...GOOD, name: "hy-phen" }, "page")).toEqual({ ok: false, error: "bad_name" });
  });

  it("refuses broken text with a sentence naming the field", () => {
    expect(checkClanFields({ ...GOOD, name: "  " }, "create")).toEqual({ ok: false, error: "The clan's name cannot be empty." });
    expect(checkClanFields({ ...GOOD, name: "x".repeat(21) }, "page")).toEqual({
      ok: false,
      error: "The clan's name can be at most 20 characters.",
    });
    expect(checkClanFields({ ...GOOD, motto: "a\nb" }, "create")).toEqual({ ok: false, error: "The motto must be one line." });
    expect(checkClanFields({ ...GOOD, about: "x".repeat(601) }, "page")).toEqual({
      ok: false,
      error: "About can be at most 600 characters.",
    });
  });
});

describe("checkAnswerInput", () => {
  it("takes a clan id and a yes or no", () => {
    expect(checkAnswerInput({ clanId: 1, accept: true })).toEqual({ ok: true, value: { clanId: 1, accept: true } });
    expect(checkAnswerInput({ clanId: 2147483647, accept: false })).toEqual({
      ok: true,
      value: { clanId: 2147483647, accept: false },
    });
  });

  it("refuses a request with no yes or no as one it cannot read", () => {
    expect(checkAnswerInput(null)).toEqual({ ok: false, error: "bad_request" });
    expect(checkAnswerInput({ clanId: 1 })).toEqual({ ok: false, error: "bad_request" });
    expect(checkAnswerInput({ clanId: 1, accept: "yes" })).toEqual({ ok: false, error: "bad_request" });
  });

  it.each([
    ["zero", 0],
    ["a negative id", -1],
    ["a fraction", 1.5],
    ["one past int4, which Postgres would refuse before the function runs", 2147483648],
    ["a huge number", 1e21],
    ["an id as text", "1"],
    ["no id", undefined],
  ])("reads %s as an invitation that is not there", (_what, clanId) => {
    expect(checkAnswerInput({ clanId, accept: true })).toEqual({ ok: false, error: "no_invite" });
  });
});

describe("checkPermsInput", () => {
  it("takes four levels from 0 to 6", () => {
    expect(checkPermsInput({ invite: 6, remove: 0, ranks: 1, page: 2 })).toEqual({
      ok: true,
      value: { invite: 6, remove: 0, ranks: 1, page: 2 },
    });
  });

  it.each([
    ["a level past recruit", { invite: 7, remove: 1, ranks: 1, page: 2 }],
    ["a level as text", { invite: "4", remove: 1, ranks: 1, page: 2 }],
    ["a missing one", { invite: 4, remove: 1, ranks: 1 }],
    ["a fraction", { invite: 4.5, remove: 1, ranks: 1, page: 2 }],
  ])("refuses %s", (_what, raw) => {
    expect(checkPermsInput(raw)).toEqual({ ok: false, error: "bad_perm" });
  });

  it("refuses no body as a request it cannot read", () => {
    expect(checkPermsInput(null)).toEqual({ ok: false, error: "bad_request" });
  });
});

describe("checkNoticeInput", () => {
  it("trims a one-line title and a body that may have lines", () => {
    expect(checkNoticeInput({ title: " Meet ", body: "Fountain at 5\nBring lobbies " })).toEqual({
      ok: true,
      value: { title: "Meet", body: "Fountain at 5\nBring lobbies" },
    });
  });

  it("refuses an empty, long or two-line title, and an empty or long body", () => {
    for (const raw of [
      { title: "", body: "x" },
      { title: "x".repeat(41), body: "x" },
      { title: "a\nb", body: "x" },
      { title: "Meet", body: "  " },
      { title: "Meet", body: "x".repeat(281) },
    ]) {
      expect(checkNoticeInput(raw).ok, JSON.stringify(raw)).toBe(false);
    }
    expect(checkNoticeInput(null)).toEqual({ ok: false, error: "bad_request" });
  });
});
