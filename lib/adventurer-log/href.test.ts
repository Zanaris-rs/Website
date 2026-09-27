import { describe, expect, it } from "vitest";

import {
  CHARACTER_HREF,
  CLAN_TAB_HREF,
  DIRECTORY_HREF,
  LOG_SETTINGS_HREF,
  logHref,
  outfitEditHref,
  outfitImportHref,
  outfitSlotFrom,
  SHEET_HREF,
  WORDS_HREF,
} from "./href";

describe("logHref", () => {
  it("puts a player's log under /adventurer/", () => {
    expect(logHref("zezima")).toBe("/adventurer/zezima");
  });

  it("encodes a safe name's underscores untouched and anything else escaped", () => {
    expect(logHref("lynx_titan")).toBe("/adventurer/lynx_titan");
    expect(logHref("a b/c")).toBe("/adventurer/a%20b%2Fc");
  });
});

describe("DIRECTORY_HREF", () => {
  it("is the directory of all logs", () => {
    expect(DIRECTORY_HREF).toBe("/adventurers");
  });
});

describe("the owner's pages", () => {
  it("are where the spec's table puts them", () => {
    expect(CHARACTER_HREF).toBe("/account/adventurer-log/character");
    expect(WORDS_HREF).toBe("/account/adventurer-log/character/words");
    expect(SHEET_HREF).toBe("/account/adventurer-log/character/sheet");
    expect(CLAN_TAB_HREF).toBe("/account/adventurer-log/clan");
    expect(LOG_SETTINGS_HREF).toBe("/account/adventurer-log");
  });

  it("number the outfit editor's slots from 1, and read them back from 0", () => {
    expect(outfitEditHref(0)).toBe("/account/adventurer-log/character/outfit/1");
    expect(outfitEditHref(9)).toBe("/account/adventurer-log/character/outfit/10");
    expect(outfitImportHref(3)).toBe("/account/adventurer-log/character/outfit/4?import=1");
    expect(["1", "5", "10"].map(outfitSlotFrom)).toEqual([0, 4, 9]);
  });

  it("read nothing but 1 to 10 as a slot", () => {
    expect(["0", "11", "01", "1.5", "", "abc", "-1", " 1"].map(outfitSlotFrom)).toEqual(Array(8).fill(null));
  });
});
