import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { decodeBodies, loadBodies } from "./bodies-file";
import tablesJson from "./bodies.json";
import { type BodyTables, renderFigure } from "./body";
import type { Client } from "./client";
import { BACKGROUND } from "./draw";
import { plainYaw } from "./facing";
import figure from "./figure.json";
import type { Look } from "./look";
import golden from "./turn-golden.json";

/**
 * A turned figure, drawn the way a page draws one - the committed
 * `renderer.js` and `bodies.bin`, the body assembly, and `renderFigure` at a
 * facing's yaw into the turn frame - must match, pixel for pixel, what the
 * client's own `ClientPlayer.getTempModel2` drew at that yaw when
 * `npm run chathead:update` measured the turn frame and wrote
 * `turn-golden.json`: the golden figure's named looks (the defaults and
 * the whole outfits) a quarter turn apart.
 */

const tables = tablesJson as unknown as BodyTables;
const PUBLIC = path.join(__dirname, "../../public/game/chathead");

let client: Client;

beforeAll(async () => {
  client = (await import(pathToFileURL(path.join(PUBLIC, "renderer.js")).href)) as Client;
  loadBodies(client, decodeBodies(readFileSync(path.join(PUBLIC, "bodies.bin"))));
});

function hash(pixels: Int32Array | null): string | null {
  if (!pixels || pixels.every((rgb) => rgb === BACKGROUND)) return null;
  return createHash("sha256").update(new Uint8Array(pixels.buffer)).digest("hex").slice(0, 16);
}

describe("the turn frame", () => {
  it("was drawn from the same build, and the goldens in the committed frame", () => {
    expect(golden.version).toBe(tables.version);
    expect(figure.version).toBe(tables.version);
    expect(golden.frame).toEqual(figure.turnFrame);
    expect([...new Set(golden.looks.map((entry) => entry.facing))]).toEqual([0, 4, 8, 12]);
    expect(golden.looks.length).toBeGreaterThanOrEqual(24);
  });

  it("is centred on the figure's axis, and holds every figure the plain frame holds", () => {
    const turn = figure.turnFrame;
    const plain = figure.frame;
    expect(turn.width).toBe(2 * turn.originX + 1);
    expect(turn.originX).toBeGreaterThanOrEqual(plain.originX);
    expect(turn.width - turn.originX).toBeGreaterThanOrEqual(plain.width - plain.originX);
    expect(turn.originY).toBeGreaterThanOrEqual(plain.originY);
    expect(turn.height - turn.originY).toBeGreaterThanOrEqual(plain.height - plain.originY);
  });
});

describe("turned golden figures", () => {
  it.each(golden.looks.map((entry) => [entry.name, entry.facing, entry] as const))(
    "%s at facing %i",
    (_name, facing, entry) => {
      const pixels = renderFigure(client, tables, entry.look as Look, figure.turnFrame, plainYaw(facing));
      expect(hash(pixels)).toBe(entry.hash);
    },
  );
});
