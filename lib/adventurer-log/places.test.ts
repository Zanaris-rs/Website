import { expect, it } from "vitest";

import { PLACES, placeName } from "./places";

it("lists the sixteen places, keyed as the database's shape allows", () => {
  expect(PLACES.map((p) => p.key)).toEqual([
    "lumbridge", "varrock", "falador", "draynor", "al_kharid", "edgeville", "port_sarim", "barbarian_village",
    "karamja", "catherby", "seers_village", "ardougne", "yanille", "canifis", "taverley", "wilderness",
  ]);
  for (const { key } of PLACES) expect(key).toMatch(/^[a-z_]{1,24}$/);
});

it("names a known key and ignores an unknown one", () => {
  expect(placeName("seers_village")).toBe("Seers' Village");
  expect(placeName("zanaris")).toBeNull();
  expect(placeName(null)).toBeNull();
});
