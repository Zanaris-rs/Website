import { expect, it } from "vitest";

import { PLACES } from "@/lib/adventurer-log/places";
import { FACINGS } from "@/lib/chathead/facing";

import spots from "./spots.json";
import { sceneOf, sceneSrc } from "./spots";

it("has a scene for most places, each a known place, framed at the card's size", () => {
  const keys = PLACES.map((p) => p.key) as string[];
  expect(spots.spots.length).toBeGreaterThanOrEqual(6);
  for (const spot of spots.spots) {
    expect(keys).toContain(spot.key);
    expect([spot.width, spot.height]).toEqual([240, 300]);
  }
});

it("finds a scene by key and ignores an unknown one", () => {
  const first = spots.spots[0];
  expect(sceneOf(first.key)?.key).toBe(first.key);
  expect(sceneOf("zanaris")).toBeNull();
  expect(sceneSrc(sceneOf(first.key)!)).toBe(`/game/scenes/${first.key}.png?v=${spots.version}`);
});

it("turns each spot only through facings the build proved, facing the camera always among them", () => {
  for (const spot of spots.spots) {
    expect(spot.turns[0]).toBe(0);
    expect(spot.turns).toEqual([...new Set(spot.turns)].sort((a, b) => a - b));
    for (const facing of spot.turns) {
      expect(Number.isInteger(facing) && facing >= 0 && facing < FACINGS).toBe(true);
    }
  }
  // Varrock square, the first spot - whose every pose the golden holds at
  // every facing it proved (composite.test.ts) - turns all the way round.
  expect(sceneOf("varrock")?.turns).toEqual(Array.from({ length: FACINGS }, (_, facing) => facing));
});
