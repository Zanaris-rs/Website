import { expect, it } from "vitest";

import worldsJson from "@/public/worlds.json";

import { CLAN_WORLDS, clanWorldName, isClanWorld } from "./worlds";

it("offers every world the site lists, by id", () => {
  expect(CLAN_WORLDS.map((world) => world.id)).toEqual(worldsJson.map((world) => world.id));
  const first = worldsJson[0];
  expect(isClanWorld(first.id)).toBe(true);
  expect(clanWorldName(first.id)).toBe(`${first.name} (${first.region})`);
});

it("refuses what is not a listed world", () => {
  for (const bad of [0, 256, 1.5, "1", null, undefined]) expect(isClanWorld(bad)).toBe(false);
  expect(clanWorldName(null)).toBeNull();
  expect(clanWorldName(255)).toBeNull();
});
