import { describe, expect, it } from "vitest";

import { DIRECTORY_HREF, logHref } from "./href";

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
