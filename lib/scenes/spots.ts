import type { PlaceKey } from "@/lib/adventurer-log/places";

import data from "./spots.json";

/**
 * A pre-rendered scene a figure can stand in, as `npm run scenes:update`
 * writes it (`scripts/scenes/`): the backdrop is `sceneSrc(spot)`, and the
 * figure goes into it with `Model.worldRender`, as the game's `World` draws a
 * player (World.ts:1476), from `eye` — the camera's position, pitch and yaw
 * — at `figure`, facing `figure.yaw`. Positions are world scene units (128 a
 * tile); only `figure` minus `eye` matters to `worldRender`. The build has
 * proved, for every spot, that drawing a figure over the backdrop this way is
 * pixel for pixel the scene with the figure in it.
 */
export type SceneSpot = {
  key: PlaceKey;
  name: string;
  width: 240;
  height: 300;
  eye: { x: number; y: number; z: number; pitch: number; yaw: number };
  figure: { x: number; y: number; z: number; yaw: number };
};

export const SCENES = data as { version: string; spots: SceneSpot[] };

export function sceneOf(key: string | null): SceneSpot | null {
  return SCENES.spots.find((spot) => spot.key === key) ?? null;
}

export function sceneSrc(spot: SceneSpot): string {
  return `/game/scenes/${spot.key}.png?v=${SCENES.version}`;
}
