import { describe, expect, it } from "vitest";

import {
  clientUrl,
  parseWorldInfo,
  parseWorlds,
  playersLabel,
  type CountState,
} from "./worlds";

const world1 = {
  id: 1,
  name: "World 1",
  region: "US-East",
  members: true,
  url: "https://w1.04.retired.invalid",
};

describe("parseWorlds", () => {
  it("accepts a valid world list", () => {
    expect(parseWorlds([world1])).toEqual([
      {
        id: 1,
        name: "World 1",
        region: "US-East",
        members: true,
        url: "https://w1.04.retired.invalid",
      },
    ]);
  });

  it("accepts an empty list", () => {
    expect(parseWorlds([])).toEqual([]);
  });

  it("trims a trailing slash from the url", () => {
    const [world] = parseWorlds([
      { ...world1, url: "https://w1.04.retired.invalid/" },
    ]);
    expect(world.url).toBe("https://w1.04.retired.invalid");
  });

  it("throws when a field is missing", () => {
    const { region: _region, ...withoutRegion } = world1;
    void _region;
    expect(() => parseWorlds([withoutRegion])).toThrow(/region/);
  });

  it("throws when a field has the wrong type", () => {
    expect(() => parseWorlds([{ ...world1, members: "yes" }])).toThrow(
      /members/,
    );
  });

  it("throws when the payload is not an array", () => {
    expect(() => parseWorlds({ worlds: [world1] })).toThrow(/array/);
    expect(() => parseWorlds(null)).toThrow(/array/);
  });

  it("throws on garbage entries", () => {
    expect(() => parseWorlds(["nope"])).toThrow();
    expect(() => parseWorlds([null])).toThrow();
  });
});

describe("parseWorldInfo", () => {
  it("accepts a valid world.json payload", () => {
    expect(
      parseWorldInfo({ id: 1, members: true, players: 3, maxPlayers: 150 }),
    ).toEqual({ id: 1, members: true, players: 3, maxPlayers: 150 });
  });

  it("ignores unknown extra fields", () => {
    expect(
      parseWorldInfo({
        id: 2,
        members: false,
        players: 0,
        maxPlayers: 2000,
        uptime: 42,
      }),
    ).toEqual({ id: 2, members: false, players: 0, maxPlayers: 2000 });
  });

  it("throws when a field is missing", () => {
    expect(() => parseWorldInfo({ id: 1, members: true, players: 3 })).toThrow(
      /maxPlayers/,
    );
  });

  it("throws on garbage", () => {
    expect(() => parseWorldInfo("offline")).toThrow();
    expect(() => parseWorldInfo(null)).toThrow();
  });
});

describe("playersLabel", () => {
  it("shows an ellipsis while loading", () => {
    expect(playersLabel({ kind: "loading" })).toBe("...");
  });

  it("shows players over the maximum when known", () => {
    const state: CountState = { kind: "ok", players: 3, maxPlayers: 150 };
    expect(playersLabel(state)).toBe("3 / 150");
  });

  it("shows offline when the world could not be reached", () => {
    expect(playersLabel({ kind: "offline" })).toBe("offline");
  });
});

describe("clientUrl", () => {
  it("builds the high detail client url", () => {
    expect(clientUrl("https://w1.04.retired.invalid", false)).toBe(
      "https://w1.04.retired.invalid/rs2.cgi",
    );
  });

  it("builds the low detail client url", () => {
    expect(clientUrl("https://w1.04.retired.invalid", true)).toBe(
      "https://w1.04.retired.invalid/rs2.cgi?lowmem=1",
    );
  });

  it("does not double up a slash when the origin has one", () => {
    expect(clientUrl("https://w1.04.retired.invalid/", false)).toBe(
      "https://w1.04.retired.invalid/rs2.cgi",
    );
  });
});
