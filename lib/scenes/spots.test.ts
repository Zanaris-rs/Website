import { expect, it } from "vitest";

import { PLACES } from "@/lib/adventurer-log/places";
import { FACINGS } from "@/lib/chathead/facing";

import { PHOTO_FALLBACK } from "./photo";
import spots from "./spots.json";
import { SCENES, sceneOf, sceneSrc } from "./spots";

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

it("holds a clan photo of 5 or more at the fallback, and every photo is 3, 5 or 7 in a row on the figure's spot", () => {
  expect(PHOTO_FALLBACK).toBe("varrock");
  expect(sceneOf(PHOTO_FALLBACK)?.photo?.length ?? 0).toBeGreaterThanOrEqual(5);
  for (const spot of SCENES.spots) {
    if (!spot.photo) continue;
    expect([3, 5, 7]).toContain(spot.photo.length);
    expect(spot.photo[(spot.photo.length - 1) / 2]).toEqual(spot.figure);
    spot.photo.forEach((slot, i) => {
      expect(slot.yaw).toBe(spot.figure.yaw);
      if (i === 0) return;
      const step = Math.hypot(slot.x - spot.photo![i - 1].x, slot.z - spot.photo![i - 1].z);
      expect(step).toBeGreaterThan(62);
      expect(step).toBeLessThan(66);
    });
  }
});
