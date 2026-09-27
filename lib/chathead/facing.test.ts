import { describe, expect, it } from "vitest";

import { FIGURE_CAMERA } from "./body";
import { FACING_NAMES, FACINGS, nearestFacing, plainYaw, sceneYaw, stepFacing } from "./facing";

describe("facings", () => {
  it("are sixteen steps of 128 yaw units, facing 0 the angle figures have always had", () => {
    expect(FACINGS).toBe(16);
    expect(plainYaw(0)).toBe(FIGURE_CAMERA.yan);
    expect(plainYaw(1)).toBe(166 + 128);
    expect(plainYaw(15)).toBe((166 + 15 * 128) & 2047);
    expect(plainYaw(16)).toBe(plainYaw(0));
    expect(plainYaw(-1)).toBe(plainYaw(15));
  });

  it("turn a scene's figure from the spot's own yaw", () => {
    expect(sceneYaw(1024, 0)).toBe(1024);
    expect(sceneYaw(1024, 8)).toBe(0);
    expect(sceneYaw(2000, 1)).toBe(80);
    expect(sceneYaw(0, 15)).toBe(1920);
  });

  it("step through all sixteen with no list, wrapping", () => {
    expect(stepFacing(0, 1)).toBe(1);
    expect(stepFacing(0, -1)).toBe(15);
    expect(stepFacing(15, 1)).toBe(0);
    expect(stepFacing(3, 5)).toBe(8);
    expect(stepFacing(3, 0)).toBe(3);
  });

  it("step along an allowed list in its order, wrapping at either end", () => {
    const turns = [0, 1, 2, 14, 15];
    expect(stepFacing(2, 1, turns)).toBe(14);
    expect(stepFacing(14, -1, turns)).toBe(2);
    expect(stepFacing(15, 1, turns)).toBe(0);
    expect(stepFacing(0, -1, turns)).toBe(15);
    expect(stepFacing(0, 3, [0, 4, 8, 12])).toBe(12);
    expect(stepFacing(0, -2, [0, 4, 8, 12])).toBe(8);
  });

  it("step from the nearest allowed facing when the start is not allowed", () => {
    expect(stepFacing(5, 1, [0, 4, 8, 12])).toBe(8);
    expect(stepFacing(5, -1, [0, 4, 8, 12])).toBe(0);
    expect(stepFacing(7, 0, [0])).toBe(0);
  });

  it("find the nearest allowed facing the short way round, the first in the list on a tie", () => {
    expect(nearestFacing(6)).toBe(6);
    expect(nearestFacing(17)).toBe(1);
    expect(nearestFacing(6, [0, 4, 8, 12])).toBe(4);
    expect(nearestFacing(15, [0, 4, 8, 12])).toBe(0);
    expect(nearestFacing(13, [0, 4, 8, 12])).toBe(12);
    expect(nearestFacing(9, [0, 4, 8, 12])).toBe(8);
    expect(nearestFacing(9, null)).toBe(9);
    expect(nearestFacing(9, [])).toBe(0);
  });

  it("name every facing, turning left from facing you round to a little right", () => {
    expect(FACING_NAMES).toHaveLength(FACINGS);
    expect(FACING_NAMES[0]).toBe("facing you");
    expect(FACING_NAMES[1]).toBe("a little left");
    expect(FACING_NAMES[4]).toBe("side-on, left");
    expect(FACING_NAMES[8]).toBe("back to you");
    expect(FACING_NAMES[12]).toBe("side-on, right");
    expect(FACING_NAMES[15]).toBe("a little right");
  });
});
