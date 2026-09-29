import { describe, expect, it } from "vitest";

import type { Rank } from "@/lib/clans/ranks";

import {
  centreOut,
  centreOutSlot,
  farToNear,
  PHOTO_COUNTS,
  PHOTO_FALLBACK,
  PHOTO_SPACING,
  photoOrder,
  photoSitters,
  photoSlots,
  projectSitter,
  type SitterBody,
  type Trig,
} from "./photo";
import { SCENES, type SceneSpot, sceneOf } from "./spots";

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

describe("photoSitters", () => {
  const ranks: Rank[] = ["recruit", "corporal", "sergeant", "lieutenant", "captain", "general", "leader"];
  const seven = ranks.map((rank) => sitter(rank, rank));
  const three: SceneSpot = { ...base, photo: row.photo!.slice(2, 5) };

  it("caps the sitters at the spot's own slot count, keeping the top ranks, the Leader in the middle", () => {
    expect(photoSitters(three, seven).map((s) => s.name)).toEqual(["general", "leader", "captain"]);
    expect(photoSitters(row, seven).map((s) => s.name)).toEqual([
      "corporal",
      "lieutenant",
      "general",
      "leader",
      "captain",
      "sergeant",
      "recruit",
    ]);
  });

  it("keeps the given order within a rank at the cap, and stands fewer than the slots on the centre run", () => {
    const recruits = [sitter("l", "leader"), sitter("r1", "recruit"), sitter("r2", "recruit"), sitter("r3", "recruit")];
    expect(photoSitters(three, recruits).map((s) => s.name)).toEqual(["r1", "l", "r2"]);
    const two = photoSitters(three, [sitter("r", "recruit"), sitter("l", "leader")]);
    expect(two.map((s) => s.name)).toEqual(["r", "l"]);
    // The Leader stands on the 3-slot spot's centre slot.
    expect(photoSlots(three, two.length)[1]).toEqual(three.photo![1]);
  });

  it("stands no one where there are no slots", () => {
    expect(photoSitters({ ...base, photo: undefined }, seven)).toEqual([]);
  });
});

describe("farToNear", () => {
  it("draws the outer slots first and the middle last, ties left first", () => {
    const facing: SceneSpot = { ...row, eye: { ...base.eye, x: 192, z: -1000 } };
    expect(farToNear(facing, row.photo!)).toEqual([0, 6, 1, 5, 2, 4, 3]);
  });
});

it("tries seven, then five, then three, half a tile apart, and falls back to Varrock square", () => {
  expect(PHOTO_COUNTS).toEqual([7, 5, 3]);
  expect(PHOTO_SPACING).toBe(64);
  expect(PHOTO_FALLBACK).toBe("varrock");
});

describe("centreOut", () => {
  it("stands the first in the middle, then one to its left, one to its right, and on outward", () => {
    expect(centreOut(["a", "b", "c", "d", "e"])).toEqual(["d", "b", "a", "c", "e"]);
    expect(centreOut(["a", "b", "c", "d"])).toEqual(["d", "b", "a", "c"]);
    expect(centreOut(["a", "b"])).toEqual(["b", "a"]);
    expect(centreOut(["a"])).toEqual(["a"]);
    expect(centreOut([])).toEqual([]);
  });

  it("says where each one stands", () => {
    expect([0, 1, 2, 3, 4].map((i) => centreOutSlot(i, 5))).toEqual([2, 1, 3, 0, 4]);
    expect([0, 1].map((i) => centreOutSlot(i, 2))).toEqual([1, 0]);
  });
});

/** Pix3D's tables, as its static initialiser makes them. */
function pix3d(): Trig {
  const sinTable = new Int32Array(2048);
  const cosTable = new Int32Array(2048);
  for (let i = 0; i < 2048; i++) {
    sinTable[i] = (Math.sin(i * 0.0030679615757712823) * 65536) | 0;
    cosTable[i] = (Math.cos(i * 0.0030679615757712823) * 65536) | 0;
  }
  return { sinTable, cosTable };
}

/** A post 200 high with arms 20 out to each side and 20 fore and aft. */
const post: SitterBody = {
  minY: 200,
  numPoints: 6,
  pointX: [0, 0, -20, 20, 0, 0],
  pointY: [0, -200, -100, -100, -100, -100],
  pointZ: [0, 0, 0, 0, -20, 20],
};

describe("projectSitter", () => {
  const varrock = sceneOf("varrock")!;
  const slots = varrock.photo!;

  it("hangs the chat over the centre slot at the picture's centre, and boxes the body around it", () => {
    expect(slots).toHaveLength(7);
    expect(projectSitter(pix3d(), varrock, slots[3], post)).toEqual({
      head: { x: 120, y: 164 },
      box: { x: 110, y: 164, w: 21, h: 97 },
    });
  });

  it("places Varrock square's seven slots left to right, mirrored about the centre", () => {
    const placed = slots.map((slot) => projectSitter(pix3d(), varrock, slot, post));
    expect(placed.map((sitter) => sitter.head.x)).toEqual([23, 55, 88, 120, 152, 185, 217]);
    for (let i = 0; i < 7; i++) {
      const mirror = placed[6 - i];
      expect(placed[i].head.y).toBe(164);
      // The box's right edge is its last pixel, x + w - 1.
      expect(placed[i].box.x - 120).toBe(120 - (mirror.box.x + mirror.box.w - 1));
      expect(placed[i].box.x).toBeLessThanOrEqual(placed[i].head.x);
      expect(placed[i].box.x + placed[i].box.w).toBeGreaterThan(placed[i].head.x);
    }
  });

  it("turns the body by the slot's yaw, about its base, before projecting it", () => {
    // A post with one arm 40 along its x and one 20 along its z, so each
    // quarter turn swings the arms somewhere new. Worked by hand with Pix3D's
    // tables (sin 64 = 12785, cos 64 = 64276; a quarter turn is exactly
    // 0 and +-65536): at the centre slot an arm 100 up, 980 ahead of the eye
    // and 40 or 20 across lands 20 or 10 px from the centre.
    const signpost: SitterBody = {
      minY: 200,
      numPoints: 4,
      pointX: [0, 0, 40, 0],
      pointY: [0, -200, -100, -100],
      pointZ: [0, 0, 0, 20],
    };
    const turned = (yaw: number) => projectSitter(pix3d(), varrock, { ...slots[3], yaw }, signpost);
    // Unturned, the x arm reaches right.
    expect(turned(0).box).toEqual({ x: 120, y: 164, w: 21, h: 97 });
    // A quarter: the x arm turns toward the eye, the z arm out to the right.
    expect(turned(512).box).toEqual({ x: 120, y: 164, w: 11, h: 97 });
    // A half: the x arm reaches left.
    expect(turned(1024).box).toEqual({ x: 100, y: 164, w: 21, h: 97 });
    // Three quarters: the z arm reaches left.
    expect(turned(1536).box).toEqual({ x: 110, y: 164, w: 11, h: 97 });
    // The chat hangs over the base, however the body is turned.
    for (const yaw of [0, 512, 1024, 1536]) expect(turned(yaw).head).toEqual({ x: 120, y: 164 });
  });

  it("cuts the box to the frame, and gives a body with no points an empty box at its head", () => {
    const offLeft = projectSitter(pix3d(), varrock, { ...slots[0], x: varrock.eye.x - 2000 }, post);
    expect(offLeft.box.x).toBe(0);
    expect(offLeft.box.w).toBe(0);
    const nothing: SitterBody = { minY: 0, numPoints: 0, pointX: null, pointY: null, pointZ: null };
    const none = projectSitter(pix3d(), varrock, slots[3], nothing);
    expect(none.box).toEqual({ x: none.head.x, y: none.head.y, w: 0, h: 0 });
  });

  it("refuses a slot behind the eye", () => {
    expect(() => projectSitter(pix3d(), varrock, { ...slots[3], z: varrock.eye.z - 500 }, post)).toThrow(/behind/);
  });
});
