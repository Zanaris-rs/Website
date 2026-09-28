/**
 * Which way a figure faces: sixteen steps round, each 128 of the client's
 * 2048 yaw units. Facing 0 is the angle the site has always drawn a figure
 * at: for the plain figure the design screen's `yan`, 166 (`FIGURE_CAMERA`,
 * body.ts); in a scene the spot's own angle, facing the camera
 * (`spot.figure.yaw`). Each step up turns the figure's face toward your
 * left - the client's `objRender` and `worldRender` turn a model that way
 * for a larger yaw - so "Turn left" and the left arrow step up, "Turn
 * right" and the right arrow step down.
 *
 * A persona keeps one (`facing`, 0-15, migration 017): the way the figure
 * faces when someone opens the log. A scene turns only through the facings
 * its build proved (`SceneSpot.turns`); the plain figure turns through all
 * sixteen, in the turn frame (`figure.json`'s `turnFrame`).
 */

export const FACINGS = 16;

/** One step, in yaw units. */
const STEP = 128;

/** Facing 0 of the plain figure: `FIGURE_CAMERA.yan` (facing.test.ts holds the two together). */
const PLAIN_YAW = 166;

/** Any number as a facing, 0-15: rounded and wrapped round (16 is 0, -1 is 15); not a number is 0. */
function wrap(facing: number): number {
  const whole = Number.isFinite(facing) ? Math.round(facing) : 0;
  return ((whole % FACINGS) + FACINGS) % FACINGS;
}

/** The plain figure's camera yaw at a facing: `drawModel`'s `yan`. */
export function plainYaw(facing: number): number {
  return (PLAIN_YAW + wrap(facing) * STEP) & 2047;
}

/** A figure's own yaw in a scene at a facing, turned from the spot's: `worldRender`'s `yaw`. */
export function sceneYaw(spotYaw: number, facing: number): number {
  return (spotYaw + wrap(facing) * STEP) & 2047;
}

/** CSS pixels of sideways drag for each step a figure turns (the log's card, the outfit editor). */
export const DRAG_STEP = 14;

/** A press that moves no further than this, in CSS pixels, stays a click rather than a turn. */
export const DRAG_SLOP = 4;

/**
 * How many steps a sideways drag of `dx` CSS pixels, from where it began,
 * turns a figure: one each `DRAG_STEP`, to the nearest step, the same
 * distance either way. A drag right turns the face toward your right, so it
 * follows the pointer - facing down - so a drag right is negative.
 */
export function dragSteps(dx: number): number {
  if (!Number.isFinite(dx)) return 0;
  const steps = Math.round(Math.abs(dx) / DRAG_STEP);
  if (steps === 0) return 0;
  return dx > 0 ? -steps : steps;
}

/** How many steps apart two facings are, the short way round: 0-8. */
function apart(a: number, b: number): number {
  const steps = Math.abs(a - b);
  return Math.min(steps, FACINGS - steps);
}

/**
 * The facing to draw for `facing` where only `allowed` may be drawn (a
 * scene's `turns`): itself if it is allowed, else the allowed facing fewest
 * steps away, the first in the list on a tie. With no list every facing is
 * allowed; an empty list allows only 0.
 */
export function nearestFacing(facing: number, allowed?: readonly number[] | null): number {
  const wanted = wrap(facing);
  if (!allowed) return wanted;
  let best: number | null = null;
  for (const candidate of allowed) {
    const c = wrap(candidate);
    if (best === null || apart(wanted, c) < apart(wanted, best)) best = c;
  }
  return best ?? 0;
}

/**
 * Turn `delta` steps from `facing` (positive toward your left, negative
 * toward your right): through every facing with no list, or along `allowed`
 * in its order, wrapping at either end, from the allowed facing nearest
 * `facing` when it is not one itself.
 */
export function stepFacing(facing: number, delta: number, allowed?: readonly number[] | null): number {
  const steps = Number.isFinite(delta) ? Math.round(delta) : 0;
  if (!allowed) return wrap(wrap(facing) + steps);
  if (allowed.length === 0) return 0;
  const from = nearestFacing(facing, allowed);
  const at = allowed.findIndex((candidate) => wrap(candidate) === from);
  const count = allowed.length;
  return wrap(allowed[(((at + steps) % count) + count) % count]);
}

/** Each facing's name, as the owner's Look tab says it ("you face: ..."). */
export const FACING_NAMES: readonly string[] = [
  "facing you", "a little left", "three-quarter left", "nearly side-on",
  "side-on, left", "turning away", "over the shoulder", "nearly back",
  "back to you", "nearly back", "over the shoulder", "turning away",
  "side-on, right", "nearly side-on", "three-quarter right", "a little right",
];
