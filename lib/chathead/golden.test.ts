import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { beforeAll, describe, expect, it } from "vitest";

import { type Client, prepare } from "./client";
import { BACKGROUND, renderChathead } from "./draw";
import golden from "./golden.json";
import type { HeadTables } from "./head";
import tablesJson from "./heads.json";
import type { Look } from "./look";
import { decodeModels, loadModels } from "./models";

/**
 * Every golden look, drawn the way a page draws it — the committed
 * `renderer.js`, the committed `models.bin` and `heads.json`, and this
 * directory's head assembly — must match, pixel for pixel, what the client's
 * own `ClientPlayer.getHeadModel` drew when `npm run chathead:update` wrote
 * `golden.json`. Between them the looks cover every kit with a head, every
 * hat on both genders, and every colour of every part.
 *
 * A failure after a regeneration means the site's assembly and the client's
 * disagree; a failure without one means a generated file was edited or
 * committed out of step with the others.
 */

const tables = tablesJson as HeadTables;
const PUBLIC = path.join(__dirname, "../../public/game/chathead");

let client: Client;

beforeAll(async () => {
  client = (await import(
    pathToFileURL(path.join(PUBLIC, "renderer.js")).href
  )) as Client;
  prepare(client);
  loadModels(client, decodeModels(readFileSync(path.join(PUBLIC, "models.bin"))));
});

function hash(pixels: Int32Array): string {
  return createHash("sha256")
    .update(new Uint8Array(pixels.buffer))
    .digest("hex")
    .slice(0, 16);
}

describe("golden chatheads", () => {
  it("were drawn from the same build as the tables", () => {
    expect(golden.version).toBe(tables.version);
    expect(golden.looks.length).toBeGreaterThan(300);
  });

  it.each(golden.looks.map((entry) => [entry.name, entry] as const))(
    "%s",
    (_name, entry) => {
      const pixels = renderChathead(client, tables, entry.look as Look);
      const blank = !pixels || pixels.every((rgb) => rgb === BACKGROUND);
      expect(blank ? null : hash(pixels!)).toBe(entry.hash);
    },
  );
});
