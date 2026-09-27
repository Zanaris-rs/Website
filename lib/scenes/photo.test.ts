import { describe, expect, it } from "vitest";

import type { Rank } from "@/lib/clans/ranks";

import { farToNear, PHOTO_COUNTS, PHOTO_SPACING, photoOrder, photoSlots } from "./photo";
import { SCENES, type SceneSpot } from "./spots";

const sitter = (name: string, rank: Rank) => ({ name, rank });

describe("photoOrder", () => {
  it("puts the top rank in the middle and the rest out to either side, left first", () => {
    const five = [
      sitter("r", "recruit"),
      sitter("l", "leader"),
      sitter("g", "general"),
      sitter("c", "captain"),
      sitter("k", "corporal"),
    ];
    expect(photoOrder(five).map((s) => s.name)).toEqual(["k", "g", "l", "c", "r"]);
    const four = [sitter("l", "leader"), sitter("g", "general"), sitter("c", "captain"), sitter("r", "recruit")];
    expect(photoOrder(four).map((s) => s.name)).toEqual(["r", "g", "l", "c"]);
  });

  it("keeps the given order within a rank", () => {
    const three = [sitter("l", "leader"), sitter("r1", "recruit"), sitter("r2", "recruit")];
    expect(photoOrder(three).map((s) => s.name)).toEqual(["r1", "l", "r2"]);
  });

  it("stands none and one", () => {
    expect(photoOrder([])).toEqual([]);
    expect(photoOrder([sitter("g", "general")]).map((s) => s.name)).toEqual(["g"]);
  });

  it("never loses or repeats anyone, and the Leader of seven stands fourth", () => {
    const ranks: Rank[] = ["leader", "general", "captain", "lieutenant", "sergeant", "corporal", "recruit"];
    const placed = photoOrder(ranks.map((rank, i) => sitter(String(i), rank)));
    expect(placed).toHaveLength(7);
    expect(new Set(placed).size).toBe(7);
    expect(placed[3].rank).toBe("leader");
  });
});

const base = SCENES.spots[0];
const row: SceneSpot = { ...base, photo: [0, 1, 2, 3, 4, 5, 6].map((i) => ({ x: i * 64, y: 0, z: 0, yaw: 1024 })) };

describe("photoSlots", () => {
  it("stands n sitters on the middle run of slots, so the top rank is on the centre one", () => {
    expect(photoSlots(row, 7)).toEqual(row.photo);
    expect(photoSlots(row, 4).map((slot) => slot.x)).toEqual([64, 128, 192, 256]);
    expect(photoSlots(row, 1).map((slot) => slot.x)).toEqual([192]);
    expect(photoSlots(row, 0)).toEqual([]);
  });

  it("refuses more sitters than slots", () => {
    expect(() => photoSlots(row, 8)).toThrow(/8/);
    expect(() => photoSlots({ ...base, photo: undefined }, 1)).toThrow(/slots/);
  });
});

describe("farToNear", () => {
  it("draws the outer slots first and the middle last, ties left first", () => {
    const facing: SceneSpot = { ...row, eye: { ...base.eye, x: 192, z: -1000 } };
    expect(farToNear(facing, row.photo!)).toEqual([0, 6, 1, 5, 2, 4, 3]);
  });
});

it("tries seven, then five, then three, half a tile apart", () => {
  expect(PHOTO_COUNTS).toEqual([7, 5, 3]);
  expect(PHOTO_SPACING).toBe(64);
});
