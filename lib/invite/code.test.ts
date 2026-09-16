import { describe, expect, it } from "vitest";

import {
  INVITE_ALPHABET,
  INVITE_CODE_PATTERN,
  encodeInviteCode,
  formatInviteCode,
  normalizeInviteCode,
} from "./code";

// The same vectors are pinned in the engine's test/InviteCode.test.ts: staff
// mint codes from the shell with account.ts, players mint them here, and the
// CHECK constraint in migration 6 is what both answer to.
const VECTORS: [number[], string][] = [
  [[0, 0, 0, 0, 0, 0, 0, 0, 0, 0], "0000000000000000"],
  [[255, 255, 255, 255, 255, 255, 255, 255, 255, 255], "ZZZZZZZZZZZZZZZZ"],
  [[1, 0, 0, 0, 0, 0, 0, 0, 0, 0], "0400000000000000"],
  [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], "000G40R40M30E209"],
  [
    [0xde, 0xad, 0xbe, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab],
    "VTPVXVR14D2PF2DB",
  ],
];

describe("the alphabet", () => {
  it("is Crockford base32, the one migration 6 checks for", () => {
    expect(INVITE_ALPHABET).toBe("0123456789ABCDEFGHJKMNPQRSTVWXYZ");
    expect(INVITE_CODE_PATTERN.source).toBe("^[0-9A-HJKMNP-TV-Z]{16}$");
    for (const letter of "ILOU") {
      expect(INVITE_ALPHABET).not.toContain(letter);
    }
  });
});

describe("encodeInviteCode", () => {
  it.each(VECTORS)("encodes %j as %s", (bytes, code) => {
    expect(encodeInviteCode(Uint8Array.from(bytes))).toBe(code);
  });

  it("refuses anything but ten bytes", () => {
    expect(() => encodeInviteCode(new Uint8Array(9))).toThrow();
    expect(() => encodeInviteCode(new Uint8Array(11))).toThrow();
  });

  it("always produces something the database accepts", () => {
    for (let i = 0; i < 200; i++) {
      const bytes = Uint8Array.from({ length: 10 }, () =>
        Math.floor(Math.random() * 256),
      );
      expect(encodeInviteCode(bytes)).toMatch(INVITE_CODE_PATTERN);
    }
  });
});

describe("normalizeInviteCode", () => {
  it("folds what a person types or pastes back to the stored form", () => {
    expect(normalizeInviteCode("vtpv-xvr1-4d2p-f2db")).toBe("VTPVXVR14D2PF2DB");
    expect(normalizeInviteCode("  VTPV XVR1 4D2P F2DB ")).toBe(
      "VTPVXVR14D2PF2DB",
    );
    expect(normalizeInviteCode("VTPV-XVRI-4D2P-F2DB")).toBe("VTPVXVR14D2PF2DB");
    expect(normalizeInviteCode("VTPV-XVRL-4D2P-F2DB")).toBe("VTPVXVR14D2PF2DB");
    expect(normalizeInviteCode("OOOO-OOOO-OOOO-OOOO")).toBe("0000000000000000");
  });

  it.each([
    "",
    "VTPV",
    "VTPVXVR14D2PF2DBX",
    "UUUUUUUUUUUUUUUU",
    "VTPV_XVR1_4D2P_F2DB",
    "💥".repeat(16),
  ])("is null for %j", (raw) => {
    expect(normalizeInviteCode(raw)).toBeNull();
  });
});

describe("formatInviteCode", () => {
  it("shows four groups of four", () => {
    expect(formatInviteCode("VTPVXVR14D2PF2DB")).toBe("VTPV-XVR1-4D2P-F2DB");
  });
});
