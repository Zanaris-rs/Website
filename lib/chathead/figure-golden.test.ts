import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { decodeBodies, loadBodies } from "./bodies-file";
import tablesJson from "./bodies.json";
import { type BodyTables, renderFigure, stanceFrame } from "./body";
import type { Client } from "./client";
import { BACKGROUND } from "./draw";
import figure from "./figure.json";
import golden from "./figure-golden.json";
import heads from "./heads.json";
import type { Look } from "./look";

/**
 * Every golden figure, drawn the way a page draws it — the committed
 * `renderer.js`, `bodies.bin` and `bodies.json`, and this directory's body
 * assembly — must match, pixel for pixel, what the client's own
 * `ClientPlayer.getTempModel2` drew when `npm run chathead:update` wrote
 * `figure-golden.json`. Between them the looks cover every kit with a body,
 * every colour of every part, and every wearable object on both genders:
 * each slot, each weapon in its own stance, the textured chainbodies, and
 * the objects that empty another slot.
 *
 * The reference took what each object hides, and each weapon's stance,
 * from the server's config, not from `bodies.json`; so a table exported
 * wrong fails here, as a failure after a regeneration means the site's
 * assembly and the client's disagree.
 */

const tables = tablesJson as unknown as BodyTables;
const PUBLIC = path.join(__dirname, "../../public/game/chathead");

let client: Client;

beforeAll(async () => {
  client = (await import(
    pathToFileURL(path.join(PUBLIC, "renderer.js")).href
  )) as Client;
  loadBodies(client, decodeBodies(readFileSync(path.join(PUBLIC, "bodies.bin"))));
});

function hash(pixels: Int32Array | null): string | null {
  if (!pixels || pixels.every((rgb) => rgb === BACKGROUND)) return null;
  return createHash("sha256")
    .update(new Uint8Array(pixels.buffer))
    .digest("hex")
    .slice(0, 16);
}

describe("golden figures", () => {
  it("were drawn from the same build as the tables and the frame", () => {
    expect(golden.version).toBe(tables.version);
    expect(figure.version).toBe(tables.version);
    expect(golden.looks.length).toBeGreaterThan(1500);
  });

  it.each(golden.looks.map((entry) => [entry.name, entry] as const))(
    "%s",
    (_name, entry) => {
      const pixels = renderFigure(client, tables, entry.look as Look, figure.frame);
      expect(hash(pixels)).toBe(entry.hash);
    },
  );
});

describe("body tables", () => {
  const MALE: Look = {
    gender: 0,
    kits: [0, 10, 18, 26, 33, 36, 42],
    colours: [0, 0, 0, 0, 0],
    worn: new Array(14).fill(-1),
  };

  it("hide every slot an object empties, not only the head's", () => {
    // Slots (`equip.constant`): 5 shield, 6 arms, 8 hair, 11 jaw.
    expect(tables.hides[1127]).toEqual([6]); // rune platebody: the arms
    expect(tables.hides[1319]).toEqual([5]); // rune 2h sword: the shield
    expect(tables.hides[1163]).toEqual([8, 11]); // rune full helm: hair and jaw
    const headSlots = new Set([0, 8, 11]);
    const beyondHead = Object.values(tables.hides).filter((slots) =>
      slots.some((slot) => !headSlots.has(slot)),
    );
    expect(beyondHead.length).toBeGreaterThan(100);
    expect(Object.keys(tables.hides).length).toBeGreaterThan(
      Object.keys(heads.hides).length,
    );
  });

  it("stand a player in their weapon's stance", () => {
    const frames = tables.stances.frames;
    const ready = frames[tables.stances.default];
    expect(stanceFrame(tables, MALE)).toBe(ready);

    const sword = [...MALE.worn];
    sword[3] = 1333; // rune scimitar: no stance of its own
    expect(stanceFrame(tables, { ...MALE, worn: sword })).toBe(ready);

    const staff = [...MALE.worn];
    staff[3] = 1381; // staff of air: human_staffready
    const staffFrame = stanceFrame(tables, { ...MALE, worn: staff });
    expect(staffFrame).toBe(frames[tables.stances.weapons[1381]]);
    expect(staffFrame).not.toBe(ready);
  });
});
