import { describe, expect, it } from "vitest";

import { frameAt, lineCount } from "./animate";

it("picks a mood's seq by a line count held to 1..4", () => {
  expect([0, 1, 2, 3, 4, 5, 2.4, NaN, -3].map(lineCount)).toEqual([1, 1, 2, 3, 4, 4, 2, 1, 1]);
});

describe("frameAt", () => {
  it("holds each frame for its cycles, and ends a clip that plays once", () => {
    const clip = { delays: [2, 3], loop: null };
    expect([0, 1, 2, 3, 4, 5, 60].map((t) => frameAt(clip, t))).toEqual([
      0, 0, 1, 1, 1, null, null,
    ]);
  });

  it("goes back to the loop frame after the last, for ever", () => {
    // Four frames; after the last it goes back to the third, as a mood's
    // talk settles into its last few frames.
    const clip = { delays: [1, 1, 2, 2], loop: 2 };
    expect([...Array(15).keys()].map((t) => frameAt(clip, t))).toEqual([
      0, 1, 2, 2, 3, 3, 2, 2, 3, 3, 2, 2, 3, 3, 2,
    ]);
  });

  it("repeats the whole clip when it loops to the first frame", () => {
    const clip = { delays: [1, 2], loop: 0 };
    expect([...Array(7).keys()].map((t) => frameAt(clip, t))).toEqual([0, 1, 1, 0, 1, 1, 0]);
  });

  it("starts at the first frame for a time before the start", () => {
    expect(frameAt({ delays: [3], loop: null }, -5)).toBe(0);
  });
});
