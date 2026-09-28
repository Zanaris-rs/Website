import { describe, expect, it } from "vitest";

import { FIGURE_CAMERA, plainCamera } from "./body";
import {
  DRAG_SLOP,
  DRAG_STEP,
  dragSteps,
  FACING_NAMES,
  FACINGS,
  nearestFacing,
  plainYaw,
  sceneYaw,
  stepFacing,
} from "./facing";

describe("facings", () => {
  it("are sixteen steps of 128 yaw units, facing 0 the angle figures have always had", () => {
    expect(FACINGS).toBe(16);
    expect(plainYaw(0)).toBe(FIGURE_CAMERA.yan);
    expect(plainYaw(1)).toBe(166 + 128);
    expect(plainYaw(15)).toBe((166 + 15 * 128) & 2047);
    expect(plainYaw(16)).toBe(plainYaw(0));
    expect(plainYaw(-1)).toBe(plainYaw(15));
  });

  it("turn the plain figure's camera to a facing, facing 0 the camera itself", () => {
    expect(plainCamera(0)).toEqual(FIGURE_CAMERA);
    expect(plainCamera(4)).toEqual({ ...FIGURE_CAMERA, yan: plainYaw(4) });
    expect(plainCamera(17)).toEqual(plainCamera(1));
    expect(plainCamera(-1).yan).toBe(plainYaw(15));
    expect(plainCamera(3)).not.toBe(FIGURE_CAMERA);
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

describe("dragSteps", () => {
  it("turns a step each 14 px, a drag of 4 px or less being a click", () => {
    expect(DRAG_STEP).toBe(14);
    expect(DRAG_SLOP).toBe(4);
  });

  it("is no turn at all without a drag, or for a drag shorter than half a step", () => {
    expect(dragSteps(0)).toBe(0);
    expect(dragSteps(3)).toBe(0);
    expect(dragSteps(-3)).toBe(0);
    expect(dragSteps(Number.NaN)).toBe(0);
  });

  it("turns toward your right (down) for a drag right, so the face follows the pointer", () => {
    expect(dragSteps(7)).toBe(-1);
    expect(dragSteps(13)).toBe(-1);
    expect(dragSteps(50)).toBe(-4);
  });

  it("turns toward your left (up) for a drag left, the same distance either way", () => {
    expect(dragSteps(-7)).toBe(1);
    expect(dragSteps(-13)).toBe(1);
    expect(dragSteps(-50)).toBe(4);
  });
});
