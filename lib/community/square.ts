import { lineCyclesFor } from "@/lib/adventurer-log/overhead";
import { combatRange } from "@/lib/adventurer-log/skills";
import type { Look } from "@/lib/chathead/look";
import type { PlayerSkill } from "@/lib/hiscores/api";
import { centreOutSlot, PHOTO_FALLBACK } from "@/lib/scenes/photo";
import { type SceneSpot, sceneOf } from "@/lib/scenes/spots";

/**
 * The Community hub's square: Varrock square with the adventurers most
 * recently about standing in it, each saying their greeting overhead in
 * turn. The rules here are pure, for the hub's data (`hub.ts`) and the
 * square itself (`components/community/Square.tsx`) alike.
 */

/** How many of the directory's most recent logs the square looks through. */
export const SQUARE_READ = 10;

/** How many stand in the square at most. */
export const SQUARE_MAX = 5;

/** Varrock square, the clan photo's fallback: the build proves its row of seven. */
export function squareSpot(): SceneSpot {
  const spot = sceneOf(PHOTO_FALLBACK);
  if (!spot?.photo || spot.photo.length < SQUARE_MAX) {
    throw new Error(`${PHOTO_FALLBACK} holds fewer than ${SQUARE_MAX} photo slots: re-run npm run scenes:update`);
  }
  return spot;
}

/** Someone standing in the square. The hub hands them over most recent first. */
export type SquareSitter = {
  username: string;
  name: string;
  /** Their saved default outfit: the only look ever drawn whole. */
  look: Look;
  /** Page 1's first line (`adventure_greeting`), its colour and effect; "" for none. */
  greeting: string;
  greetingColour: number;
  greetingEffect: number;
  /** Their combat level when the hiscores fix it; null when the Skills box would show a range. */
  combat: number | null;
};

/**
 * Who stands in the square, from the directory's rows, most recent first:
 * only a player with a saved default outfit (`looks`, from
 * `outfit_default_looks`), since a saved outfit is the only look ever drawn
 * whole (ruling S1). Anyone else is passed over and the next most recent
 * takes their place, up to `max`.
 */
export function pickSitters<T extends { username: string }>(
  rows: readonly T[],
  looks: ReadonlyMap<string, Look>,
  max: number = SQUARE_MAX,
): { row: T; look: Look }[] {
  const picked: { row: T; look: Look }[] = [];
  for (const row of rows) {
    if (picked.length >= max) break;
    const look = looks.get(row.username);
    if (look) picked.push({ row, look });
  }
  return picked;
}

/**
 * A combat level to put in the mouse-over: exact once the hiscores fix it
 * (`combatRange`'s low and high agree), else null. The log's Skills box
 * shows a range then, and the square shows no level.
 */
export function exactCombat(skills: readonly PlayerSkill[]): number | null {
  const { min, max } = combatRange(skills);
  return min === max ? min : null;
}

/** One sitter's turn to speak. `position` is where they stand, 0 the leftmost. */
export type Speaker = { position: number; text: string; colour: number; effect: number; cycles: number };

/**
 * Who speaks, in turn: the sitters with a greeting, most recent first. That
 * is the middle one first, then outward, as they stand (`centreOutSlot`).
 * Each says their line for `LINE_CYCLES`, or for one scroll pass across the
 * whole frame, `frameWidth` wide: a page's line lengths (`lineCyclesFor`).
 */
export function speakers(
  sitters: readonly Pick<SquareSitter, "greeting" | "greetingColour" | "greetingEffect">[],
  frameWidth: number,
): Speaker[] {
  return sitters.flatMap((sitter, i) =>
    sitter.greeting === ""
      ? []
      : [
          {
            position: centreOutSlot(i, sitters.length),
            text: sitter.greeting,
            colour: sitter.greetingColour,
            effect: sitter.greetingEffect,
            cycles: lineCyclesFor(sitter.greetingEffect, frameWidth)(sitter.greeting),
          },
        ],
  );
}

/**
 * Where a line of overhead chat goes: the left edge of a box as wide as the
 * frame, whose centred text sits over `headX` as nearly as the frame allows,
 * so the line is never cut off at a side. A scroll crosses the whole frame,
 * so its box is the frame. A line wider than the frame wraps inside it.
 */
export function chatLeft(headX: number, textWidth: number, effect: number, frameWidth: number): number {
  if (effect === 2) return 0;
  const half = Math.min(textWidth, frameWidth) / 2;
  const centre = Math.min(Math.max(headX, half), frameWidth - half);
  return Math.round(centre - frameWidth / 2);
}

/** The game's mouse-over for a sitter: "View log <name>", then " (level-N)" in green when exact. */
export function mouseOver(sitter: Pick<SquareSitter, "name" | "combat">): { text: string; level: string | null } {
  return {
    text: `View log ${sitter.name}`,
    level: sitter.combat === null ? null : ` (level-${sitter.combat})`,
  };
}
