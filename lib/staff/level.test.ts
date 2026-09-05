import { describe, expect, it } from "vitest";

import { STAFF_MOD_LEVEL, isStaff } from "./level";

/**
 * One comparison, and it is worth a test because it is an inequality: `> 2`
 * instead of `>= 2` would silently lock every moderator out of the inbox and
 * leave it working for the admin who checked it.
 */
describe("isStaff", () => {
  it("is moderator and above", () => {
    expect(STAFF_MOD_LEVEL).toBe(2);
    expect(isStaff({ staffModLevel: 2 })).toBe(true);
    expect(isStaff({ staffModLevel: 3 })).toBe(true);
  });

  it("is not a player, and not a helper", () => {
    expect(isStaff({ staffModLevel: 0 })).toBe(false);
    expect(isStaff({ staffModLevel: 1 })).toBe(false);
  });
});
