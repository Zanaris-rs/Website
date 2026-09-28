import { type BodyTables, buildBody } from "../chathead/body.ts";
import type { Client } from "../chathead/client.ts";
import type { Look } from "../chathead/look.ts";
import { type Rank, rankLevel } from "../clans/ranks.ts";
import { renderAtEye, sceneCanvas } from "./draw.ts";
import { type PhotoSlot, type SceneSpot, sceneOf } from "./spots.ts";

/**
 * A clan photo: as many members as the scene has slots for (7, 5 or 3), in
 * their worn outfits, standing in a row in a scene. The top rank stands in
 * the middle, on the figure's own spot, and the others stand out to either
 * side. There are no emotes, and it can't be turned. The Community hub's
 * square (`components/community/Square.tsx`) is the same drawing, with the
 * most recently about in the middle instead of the top rank.
 *
 * The build proves each spot's slots (`scripts/scenes/render.ts`): the bulky
 * reference look in every slot, all added to the world in one pass, is
 * pixel for pixel what `drawPhoto` draws, one body after another, far to
 * near, onto the backdrop. A page draws with the same `drawPhoto`
 * (`ClanPhoto`), so what the build proved is what a reader sees.
 *
 * A known limit, accepted as the single figure's is: the proof is the full
 * row in the bulky look. Fewer sitters (the centred run `photoSlots` picks)
 * and other outfits are not proved as such. Each slot of a proved row is
 * half a tile from the next, so bodies barely overlap, and a shorter run
 * leaves out only outer slots.
 *
 * Where each sitter ends up in the picture (`PlacedSitter`) is the game's
 * own arithmetic too: the point it hangs a player's overhead chat from, and
 * the box its drawn body covers, both projected from the spot's eye and
 * slots in `spots.json` and the body just drawn. It needs nothing more from
 * the build.
 *
 * Relative imports with extensions: bun loads this file in the build.
 */

/** The counts a spot's photo is tried with, most first. Odd, so one stands in the middle. */
export const PHOTO_COUNTS = [7, 5, 3] as const;

/** Half a tile between neighbours, along the camera's right. */
export const PHOTO_SPACING = 64;

/**
 * Where a photo is taken when the Leader's scene holds none: Varrock square,
 * whose row of 7 the build proves. The build fails unless this spot holds at
 * least 5 (`scripts/scenes/build.ts`). Falador park proves only 3.
 */
export const PHOTO_FALLBACK = "varrock";

/** Where a clan's photo is taken: the Leader's scene when it holds one, else `PHOTO_FALLBACK`. */
export function photoSpot(leaderScene: string | null): SceneSpot {
  const own = sceneOf(leaderScene);
  if (own?.photo?.length) return own;
  const fallback = sceneOf(PHOTO_FALLBACK);
  if (!fallback?.photo?.length) {
    throw new Error(`${PHOTO_FALLBACK} has no clan photo slots: re-run npm run scenes:update`);
  }
  return fallback;
}

/**
 * By rank, highest first; a rank keeps the order it was given. A sort, one
 * list out - not `lib/clans/ranks.ts`'s `byRank`, which groups by rank.
 */
function sortByRank<T extends { rank: Rank }>(members: readonly T[]): T[] {
  return members
    .map((member, index) => ({ member, index }))
    .sort((a, b) => rankLevel(a.member.rank) - rankLevel(b.member.rank) || a.index - b.index)
    .map(({ member }) => member);
}

/**
 * Where the `i`th of `count` stands, left to right (0-based), when the
 * first stands in the middle, then one to its left, one to its right, and
 * on outward.
 */
export function centreOutSlot(i: number, count: number): number {
  const middle = Math.floor(count / 2);
  const offset = i === 0 ? 0 : i % 2 === 1 ? -(i + 1) / 2 : i / 2;
  return middle + offset;
}

/** `items` left to right: the first in the middle, then out to either side, left first (`centreOutSlot`). */
export function centreOut<T>(items: readonly T[]): T[] {
  const placed = new Array<T>(items.length);
  items.forEach((item, i) => {
    placed[centreOutSlot(i, items.length)] = item;
  });
  return placed;
}

/**
 * The sitters left to right: by rank (a rank keeps the order it was given),
 * the first in the middle, then one to its left, one to its right, and on
 * outward (`centreOut`).
 */
export function photoOrder<T extends { rank: Rank }>(members: readonly T[]): T[] {
  return centreOut(sortByRank(members));
}

/**
 * Who stands in the photo at `spot`, left to right: the highest-ranked
 * members, as many as the spot has slots (a rank keeps the order it was
 * given), placed by `photoOrder`. The rest of the roster is left out.
 */
export function photoSitters<T extends { rank: Rank }>(spot: SceneSpot, members: readonly T[]): T[] {
  return photoOrder(sortByRank(members).slice(0, spot.photo?.length ?? 0));
}

/**
 * The slots `count` sitters stand on: the middle run of the spot's, so the
 * sitter `photoOrder` puts in the middle stands on the centre slot.
 */
export function photoSlots(spot: SceneSpot, count: number): PhotoSlot[] {
  const slots = spot.photo ?? [];
  if (count > slots.length) {
    throw new Error(`${spot.key}: ${count} in the photo, but it has ${slots.length} slots`);
  }
  const start = Math.floor((slots.length - count) / 2);
  return slots.slice(start, start + count);
}

/**
 * The order the sitters are drawn in: the farthest from the eye first, as
 * `World` draws a scene's sprites, farthest tile first. The row runs across
 * the view, so the outer slots are the far ones; a tie goes left first.
 */
export function farToNear(spot: SceneSpot, slots: readonly PhotoSlot[]): number[] {
  const distance = (slot: PhotoSlot) => (slot.x - spot.eye.x) ** 2 + (slot.z - spot.eye.z) ** 2;
  return slots.map((_, i) => i).sort((a, b) => distance(slots[b]) - distance(slots[a]) || a - b);
}

// --- where each sitter stands in the picture ----------------------------------

/**
 * One sitter in the picture, in the spot's own pixels (240x300, before any
 * scaling a page does):
 * - `head` is where the game hangs a player's overhead chat: the bottom
 *   centre of the line (Client-TS `Client.entityOverlays` projects
 *   `getOverlayPosEntity(entity, entity.height)`, `height` being the
 *   model's `minY`, and `PixFont.drawString` puts the text's top a line's
 *   height above that point).
 * - `box` holds every pixel the body was drawn on: the bounds of its
 *   points, projected as `Model.worldRender` projects them, cut to the
 *   frame. The rasteriser stops short of a face's right and bottom edges,
 *   so the box is at most a pixel wider and taller than the drawing.
 */
export type PlacedSitter = { head: { x: number; y: number }; box: { x: number; y: number; w: number; h: number } };

/** Pix3D's sine and cosine tables: 2048 steps to a turn, 16.16 fixed point. */
export type Trig = { readonly sinTable: ArrayLike<number>; readonly cosTable: ArrayLike<number> };

/**
 * The part of a built body the projection reads: its points as posed and
 * its height (`calcBoundingCylinder`'s `minY`). A `ClientModel` is one.
 */
export type SitterBody = {
  readonly minY: number;
  readonly numPoints: number;
  readonly pointX: ArrayLike<number> | null;
  readonly pointY: ArrayLike<number> | null;
  readonly pointZ: ArrayLike<number> | null;
};

/**
 * Where `body`, standing on `slot`, is in the spot's picture, seen from the
 * spot's eye as `renderAtEye` draws it: the same integer arithmetic, step
 * for step, as `Model.worldRender` (Client-TS `dash3d/Model.ts`) and
 * `Client.getOverlayPos`, about Pix3D's origin at the picture's centre
 * (`sceneFrame`). A point nearer the eye than 50 is not drawn, and not
 * counted.
 */
export function projectSitter(trig: Trig, spot: SceneSpot, slot: PhotoSlot, body: SitterBody): PlacedSitter {
  const { eye } = spot;
  const sinPitch = trig.sinTable[eye.pitch];
  const cosPitch = trig.cosTable[eye.pitch];
  const sinEyeYaw = trig.sinTable[eye.yaw];
  const cosEyeYaw = trig.cosTable[eye.yaw];
  const originX = (spot.width / 2) | 0;
  const originY = (spot.height / 2) | 0;

  /** A point relative to the eye, on screen; null when it is nearer than 50. */
  const project = (px: number, py: number, pz: number): { x: number; y: number } | null => {
    let x = px - eye.x;
    let y = py - eye.y;
    let z = pz - eye.z;
    let tmp = (z * sinEyeYaw + x * cosEyeYaw) >> 16;
    z = (z * cosEyeYaw - x * sinEyeYaw) >> 16;
    x = tmp;
    tmp = (y * cosPitch - z * sinPitch) >> 16;
    z = (y * sinPitch + z * cosPitch) >> 16;
    y = tmp;
    return z >= 50 ? { x: originX + (((x << 9) / z) | 0), y: originY + (((y << 9) / z) | 0) } : null;
  };

  // The head: `getOverlayPos`, `minY` above the ground the slot stands on.
  const head = project(slot.x, slot.y - body.minY, slot.z);
  if (!head) throw new Error(`${spot.key}: a photo slot's head is behind the eye`);

  // The box: every point, turned by the slot's yaw about the body's own
  // base, then moved to the slot, as `worldRender` does before projecting.
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  const sinYaw = slot.yaw === 0 ? 0 : trig.sinTable[slot.yaw];
  const cosYaw = slot.yaw === 0 ? 0 : trig.cosTable[slot.yaw];
  const { pointX, pointY, pointZ } = body;
  if (pointX && pointY && pointZ) {
    for (let v = 0; v < body.numPoints; v++) {
      let x = pointX[v];
      const y = pointY[v];
      let z = pointZ[v];
      if (slot.yaw !== 0) {
        const tmp = (z * sinYaw + x * cosYaw) >> 16;
        z = (z * cosYaw - x * sinYaw) >> 16;
        x = tmp;
      }
      const at = project(x + slot.x, y + slot.y, z + slot.z);
      if (!at) continue;
      left = Math.min(left, at.x);
      right = Math.max(right, at.x);
      top = Math.min(top, at.y);
      bottom = Math.max(bottom, at.y);
    }
  }
  if (right < left) {
    return { head, box: { x: clamp(head.x, 0, spot.width), y: clamp(head.y, 0, spot.height), w: 0, h: 0 } };
  }
  const x0 = clamp(left, 0, spot.width);
  const y0 = clamp(top, 0, spot.height);
  const x1 = clamp(right + 1, 0, spot.width);
  const y1 = clamp(bottom + 1, 0, spot.height);
  return { head, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
}

/** A look that builds no body: placed at its slot's foot, with an empty box. */
const NO_BODY: SitterBody = { minY: 0, numPoints: 0, pointX: null, pointY: null, pointZ: null };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * The photo, and where everyone in it stands: `looks`, left to right, each
 * built and drawn by the game client's own `Model.worldRender` from the
 * spot's eye into one copy of the backdrop, far to near, as `drawAtEye`
 * draws the card's figure (`renderAtEye`, World.ts:1476); and each one's
 * `PlacedSitter`, left to right, projected from the body just drawn. A look
 * with no body leaves its slot empty and an empty box at the slot's foot.
 * The backdrop is left as it was.
 */
export function drawPlacedPhoto(
  client: Client,
  tables: BodyTables,
  spot: SceneSpot,
  backdrop: Int32Array,
  looks: readonly Look[],
): { pixels: Int32Array; placed: PlacedSitter[] } {
  const pixels = sceneCanvas(client, spot, backdrop);
  const slots = photoSlots(spot, looks.length);
  const placed: PlacedSitter[] = slots.map((slot) => projectSitter(client.Pix3D, spot, slot, NO_BODY));
  for (const i of farToNear(spot, slots)) {
    // Building a body draws nothing, so the picture stays the canvas. The
    // body is the client's one scratch model, so it is placed before the
    // next one is built.
    const body = buildBody(client, tables, looks[i]);
    if (!body) continue;
    placed[i] = projectSitter(client.Pix3D, spot, slots[i], body);
    renderAtEye(client, body, spot, slots[i], slots[i].yaw);
  }
  return { pixels, placed };
}

/** `drawPlacedPhoto`'s picture alone: what the build proves (`scripts/scenes/render.ts`). */
export function drawPhoto(
  client: Client,
  tables: BodyTables,
  spot: SceneSpot,
  backdrop: Int32Array,
  looks: readonly Look[],
): Int32Array {
  return drawPlacedPhoto(client, tables, spot, backdrop, looks).pixels;
}
