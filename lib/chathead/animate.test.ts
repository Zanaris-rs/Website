import { describe, expect, it } from "vitest";

import { frameAt, lineCount, stillIndex, stillMoodFrames, stillPose } from "./animate";
import anims from "./anims.json";
import type { AnimTables, SeqClip } from "./anims";
import { EMOTES, MOODS } from "./vocab";

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

const seq = (frames: number[], iframes: number[] = []): SeqClip => ({
  frames, iframes, delays: frames.map(() => 1), loops: -1, hideLeft: true, hideRight: false,
});

describe("stills", () => {
  it("show a seq's middle frame", () => {
    expect([1, 2, 3, 8, 15].map(stillIndex)).toEqual([0, 1, 1, 4, 7]);
    expect(stillIndex(0)).toBe(0);
  });

  it("pose an emote at its middle frame, the hands as the seq says", () => {
    expect(stillPose(seq([10, 11, 12, 13]))).toEqual({ frame: 12, hideLeft: true, hideRight: false });
  });

  it("pose a mood's head with the middle frame and its second, or none", () => {
    expect(stillMoodFrames(seq([1, 2, 3], [7, 8, 9]))).toEqual({ first: 2, second: 8 });
    expect(stillMoodFrames(seq([1, 2, 3]))).toEqual({ first: 2, second: -1 });
  });

  it("have a frame for every emote and mood the site offers", () => {
    const tables = anims as unknown as AnimTables;
    for (const emote of EMOTES) expect(Number.isInteger(stillPose(tables.emotes[emote]).frame), emote).toBe(true);
    for (const mood of MOODS) expect(Number.isInteger(stillMoodFrames(tables.moods[mood][0]).first), mood).toBe(true);
  });
});
