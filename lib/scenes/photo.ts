import { type BodyTables, buildBody } from "../chathead/body.ts";
import type { Client } from "../chathead/client.ts";
import type { Look } from "../chathead/look.ts";
import { type Rank, rankLevel } from "../clans/ranks.ts";
import { type PhotoSlot, type SceneSpot, sceneOf } from "./spots.ts";

/**
 * A clan photo: as many members as the scene has slots for (7, 5 or 3), in
 * their worn outfits, standing in a row in a scene. The top rank stands in
 * the middle, on the figure's own spot, and the others stand out to either
 * side. There are no emotes, and it can't be turned.
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

/** By rank, highest first; a rank keeps the order it was given. */
function byRank<T extends { rank: Rank }>(members: readonly T[]): T[] {
  return members
    .map((member, index) => ({ member, index }))
    .sort((a, b) => rankLevel(a.member.rank) - rankLevel(b.member.rank) || a.index - b.index)
    .map(({ member }) => member);
}

/**
 * The sitters left to right: by rank (a rank keeps the order it was given),
 * the first in the middle, then one to its left, one to its right, and on
 * outward.
 */
export function photoOrder<T extends { rank: Rank }>(members: readonly T[]): T[] {
  const ranked = byRank(members);
  const placed = new Array<T>(ranked.length);
  const middle = Math.floor(ranked.length / 2);
  ranked.forEach((member, i) => {
    const offset = i === 0 ? 0 : i % 2 === 1 ? -(i + 1) / 2 : i / 2;
    placed[middle + offset] = member;
  });
  return placed;
}

/**
 * Who stands in the photo at `spot`, left to right: the highest-ranked
 * members, as many as the spot has slots (a rank keeps the order it was
 * given), placed by `photoOrder`. The rest of the roster is left out.
 */
export function photoSitters<T extends { rank: Rank }>(spot: SceneSpot, members: readonly T[]): T[] {
  return photoOrder(byRank(members).slice(0, spot.photo?.length ?? 0));
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

/**
 * The photo: `looks`, left to right, each built and drawn by the game
 * client's own `Model.worldRender` from the spot's eye into one copy of the
 * backdrop, far to near, as `drawAtEye` draws the card's figure
 * (World.ts:1476). A look with no body leaves its slot empty. The backdrop
 * is left as it was.
 */
export function drawPhoto(
  client: Client,
  tables: BodyTables,
  spot: SceneSpot,
  backdrop: Int32Array,
  looks: readonly Look[],
): Int32Array {
  if (backdrop.length !== spot.width * spot.height) {
    throw new Error(`${spot.key}: the backdrop is not ${spot.width}x${spot.height}`);
  }
  const slots = photoSlots(spot, looks.length);
  const pixels = backdrop.slice();
  const { eye } = spot;
  const { sinTable, cosTable } = client.Pix3D;
  for (const i of farToNear(spot, slots)) {
    const body = buildBody(client, tables, looks[i]);
    if (!body) continue;
    client.Pix2D.setPixels(pixels, spot.width, spot.height);
    client.Pix3D.setRenderClipping();
    const slot = slots[i];
    body.worldRender(
      slot.yaw,
      sinTable[eye.pitch],
      cosTable[eye.pitch],
      sinTable[eye.yaw],
      cosTable[eye.yaw],
      slot.x - eye.x,
      slot.y - eye.y,
      slot.z - eye.z,
      0,
    );
  }
  return pixels;
}
