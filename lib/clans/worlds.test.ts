import { expect, it } from "vitest";

import worldsJson from "@/public/worlds.json";

import { CLAN_WORLDS, clanWorldName, isClanWorld, listedWorld } from "./worlds";

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

it("reads a stored world the site no longer lists as none, so a page save is not refused for it", () => {
  const first = worldsJson[0].id;
  expect(listedWorld(first)).toBe(first);
  expect(listedWorld(null)).toBeNull();
  expect(listedWorld(255)).toBeNull();
  expect(isClanWorld(255)).toBe(false);
});
