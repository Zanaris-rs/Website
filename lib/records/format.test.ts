import { describe, expect, it } from "vitest";

import { formatCountdown, formatElapsed, formatGain, ordinal } from "./format";

describe("formatElapsed", () => {
  it("floors to the second", () => {
    expect(formatElapsed(304000)).toBe("5:04");
    expect(formatElapsed(310999)).toBe("5:10");
    expect(formatElapsed(59000)).toBe("0:59");
    expect(formatElapsed(0)).toBe("0:00");
  });

  it("grows an hours field for the long records", () => {
    expect(formatElapsed(6 * 3600 * 1000 + 5000)).toBe("6:00:05");
    expect(formatElapsed(24 * 3600 * 1000)).toBe("24:00:00");
  });

  it("never goes negative", () => {
    expect(formatElapsed(-5)).toBe("0:00");
  });
});

describe("formatCountdown", () => {
  it("rounds up, so it reads 0:00 at the instant the window closes", () => {
    expect(formatCountdown(300000)).toBe("5:00");
    expect(formatCountdown(299001)).toBe("5:00");
    expect(formatCountdown(299000)).toBe("4:59");
    expect(formatCountdown(1)).toBe("0:01");
    expect(formatCountdown(0)).toBe("0:00");
  });
});

describe("formatGain", () => {
  it("divides the engine's x10 away and floors, like the hiscores", () => {
    expect(formatGain(274000)).toBe("+27,400");
    expect(formatGain(12345)).toBe("+1,234");
    expect(formatGain(9)).toBe("+0");
  });
});

describe("ordinal", () => {
  it("handles the teens", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th",
    ]);
  });
});
