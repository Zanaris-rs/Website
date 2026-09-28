import { describe, expect, it, vi } from "vitest";

import { EMPTY_PERSONA } from "./persona";
import { checkStageInput, sheetOf, stageOf } from "./persona-input";

/**
 * Every place has a scene today, so these pretend one (Lumbridge) lost its
 * backdrop: a scene is a place the build framed (`sceneOf`), not any place.
 */
vi.mock("@/lib/scenes/spots", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/scenes/spots")>();
  const spots = real.SCENES.spots.filter((spot) => spot.key !== "lumbridge");
  return { ...real, SCENES: { ...real.SCENES, spots }, sceneOf: (key: string | null) => spots.find((spot) => spot.key === key) ?? null };
});

describe("the stage, against the scenes there are backdrops for", () => {
  const stored = { ...EMPTY_PERSONA, homeTown: "lumbridge", scene: "lumbridge", facing: 2 };

  it("drops a scene whose place has no backdrop, and keeps the place as a home town", () => {
    expect(checkStageInput({ scene: "lumbridge", facing: 2 }).ok).toBe(false);
    expect(stageOf(stored)).toEqual({ scene: null, facing: 2 });
    expect(checkStageInput(stageOf(stored)).ok).toBe(true);
    expect(sheetOf(stored).homeTown).toBe("lumbridge");
  });
  it("keeps a scene there is a backdrop for", () => {
    expect(stageOf({ ...stored, scene: "varrock" }).scene).toBe("varrock");
  });
});
