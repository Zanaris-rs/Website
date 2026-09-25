import { inflateSync } from "node:zlib";

import { describe, expect, it, vi } from "vitest";

import golden from "./golden.json";
import type { HeadTables } from "./head";
import heads from "./heads.json";
import type { Look } from "./look";
import { chatheadPng } from "./server";

// `server-only` throws outside a React Server build; the test is the server.
vi.mock("server-only", () => ({}));

/**
 * The server's chathead: the same renderer and models a page draws with,
 * returned as a scaled PNG for the link preview. The pixels themselves are
 * the golden test's business; this checks the size, the scaling and the
 * transparency, which are what the preview adds.
 */

const frame = (heads as HeadTables).frame;
const look = (name: string) => golden.looks.find((entry) => entry.name === name)!.look as Look;
const FIRST = golden.looks[0].look as Look;

/** A PNG from `encodePng` back to its size and RGBA rows. */
function decode(png: Buffer): { width: number; height: number; rgba: Uint8Array } {
  let at = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (at < png.length) {
    const length = png.readUInt32BE(at);
    const type = png.toString("latin1", at + 4, at + 8);
    const data = png.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
    } else if (type === "IDAT") {
      idat.push(data);
    }
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const rgba = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    expect(raw[y * (stride + 1)]).toBe(0); // filter byte
    rgba.set(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), y * stride);
  }
  return { width, height, rgba };
}

describe("chatheadPng", () => {
  it("draws the first golden look at three times the frame", async () => {
    const png = await chatheadPng(FIRST, 3);
    expect(png).not.toBeNull();
    const { width, height } = decode(png!);
    expect(width).toBe(133 * 3);
    expect(height).toBe(200 * 3);
    expect([width, height]).toEqual([frame.width * 3, frame.height * 3]);
  });

  it("gives null for a look with no head", async () => {
    expect(await chatheadPng(look("no kits"), 3)).toBeNull();
  });

  it("leaves the background transparent and the head opaque", async () => {
    const { rgba } = decode((await chatheadPng(FIRST, 3))!);
    // The top-left corner is outside any head.
    expect(rgba[3]).toBe(0);
    expect(rgba.some((value, i) => i % 4 === 3 && value === 0xff)).toBe(true);
  });

  it("scales nearest-neighbour: each pixel becomes a solid block", async () => {
    const one = decode((await chatheadPng(FIRST, 1))!);
    const three = decode((await chatheadPng(FIRST, 3))!);
    expect([one.width, one.height]).toEqual([frame.width, frame.height]);

    for (let y = 0; y < three.height; y++) {
      for (let x = 0; x < three.width; x++) {
        const src = ((y / 3) | 0) * one.width + ((x / 3) | 0);
        const dst = y * three.width + x;
        const same =
          three.rgba[dst * 4] === one.rgba[src * 4] &&
          three.rgba[dst * 4 + 1] === one.rgba[src * 4 + 1] &&
          three.rgba[dst * 4 + 2] === one.rgba[src * 4 + 2] &&
          three.rgba[dst * 4 + 3] === one.rgba[src * 4 + 3];
        if (!same) expect.fail(`pixel ${x},${y} differs from ${x / 3 | 0},${y / 3 | 0}`);
      }
    }
  });

  it("refuses a scale that is not a whole number of pixels", async () => {
    await expect(chatheadPng(FIRST, 0)).rejects.toThrow();
    await expect(chatheadPng(FIRST, 1.5)).rejects.toThrow();
  });
});
