import { describe, expect, it } from "vitest";

import {
  DEAD_INVITE_MESSAGE,
  INVITE_STATE_LABEL,
  formatCitizen,
  joinPath,
} from "./format";

describe("formatCitizen", () => {
  it("pads to four digits and no further", () => {
    expect(formatCitizen(1)).toBe("#0001");
    expect(formatCitizen(42)).toBe("#0042");
    expect(formatCitizen(12345)).toBe("#12345");
  });
});

describe("joinPath", () => {
  it("is the grouped code under /join", () => {
    expect(joinPath("VTPVXVR14D2PF2DB")).toBe("/join/VTPV-XVR1-4D2P-F2DB");
  });
});

describe("wording", () => {
  it("has a label for every state", () => {
    expect(Object.keys(INVITE_STATE_LABEL).sort()).toEqual([
      "claimed",
      "expired",
      "live",
      "revoked",
    ]);
  });

  it("explains every way a link can be dead without naming its maker", () => {
    expect(Object.keys(DEAD_INVITE_MESSAGE).sort()).toEqual([
      "claimed",
      "expired",
      "not_found",
      "rate_limited",
      "revoked",
      "unavailable",
    ]);
    for (const message of Object.values(DEAD_INVITE_MESSAGE)) {
      expect(message.length).toBeGreaterThan(10);
    }
  });
});
