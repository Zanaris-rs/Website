import { describe, expect, it, vi } from "vitest";

import { EMPTY_PERSONA } from "./persona";
import { checkPersonaInput, editablePersona, type PersonaInput } from "./persona-input";

/**
 * Every place has a scene today, so these pretend one (Lumbridge) lost its
 * backdrop: a scene is a place the build framed (`sceneOf`), not any place.
 */
vi.mock("@/lib/scenes/spots", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/scenes/spots")>();
  const spots = real.SCENES.spots.filter((spot) => spot.key !== "lumbridge");
  return { ...real, SCENES: { ...real.SCENES, spots }, sceneOf: (key: string | null) => spots.find((spot) => spot.key === key) ?? null };
});

describe("editablePersona, against the scenes there are backdrops for", () => {
  const stored: PersonaInput = { ...EMPTY_PERSONA, headline: "hi", homeTown: "lumbridge", scene: "lumbridge" };

  it("drops a scene whose place has no backdrop, and keeps the place as a home town", () => {
    expect(checkPersonaInput(stored).ok).toBe(false);
    const cleaned = editablePersona(stored);
    expect(cleaned).toEqual({ ...stored, scene: null });
    expect(checkPersonaInput(cleaned).ok).toBe(true);
  });
  it("keeps a scene there is a backdrop for", () => {
    expect(editablePersona({ ...stored, scene: "varrock" }).scene).toBe("varrock");
  });
});
