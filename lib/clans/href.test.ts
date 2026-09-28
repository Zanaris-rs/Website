import { expect, it } from "vitest";

import { CLANS_HREF, clanHref } from "./href";

it("puts a clan's page under /clan/ and the directory at /clans", () => {
  expect(clanHref("varrock-knights")).toBe("/clan/varrock-knights");
  expect(CLANS_HREF).toBe("/clans");
});
