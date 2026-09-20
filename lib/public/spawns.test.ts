import { describe, expect, it } from "vitest";

import { ECONOMY_WINDOWS, type StaffSpawn } from "./queries";
import { staffSpawnClaim } from "./spawns";

const ninety = ECONOMY_WINDOWS[3];
const spawn = (count: number): StaffSpawn => ({
  createdAt: "2026-09-10T00:00:00.000Z",
  itemId: 995,
  count,
  world: 1,
});

describe("staffSpawnClaim", () => {
  it("says nought, ever, when the whole table has been read and is empty", () => {
    const claim = staffSpawnClaim(
      { spawns: 0, items: 0, firstAt: null, lastAt: null },
      [],
      ninety,
    );
    expect(claim.items).toBe(0);
    expect(claim.allTime).toBe(true);
    expect(claim.label).toBe("items ever created by staff");
  });

  it("counts objects rather than rows, because one row can be a thousand coins", () => {
    const claim = staffSpawnClaim(
      { spawns: 2, items: 1500, firstAt: "2026-09-05T00:00:00.000Z", lastAt: null },
      [],
      ninety,
    );
    expect(claim.items).toBe(1500);
    expect(claim.detail).toContain("2");
  });

  it("falls back to the window when the all-time read is not there yet", () => {
    const claim = staffSpawnClaim(null, [spawn(3), spawn(4)], ninety);
    expect(claim.items).toBe(7);
    expect(claim.allTime).toBe(false);
    expect(claim.label).toBe("items created by staff in the last 90 days");
  });

  it("never claims nought for a window when it cannot see the whole table", () => {
    const claim = staffSpawnClaim(null, [], ninety);
    expect(claim.items).toBe(0);
    expect(claim.allTime).toBe(false);
    expect(claim.label).toContain("the last 90 days");
  });

  it("says the fallback list was cut off rather than printing a short total", () => {
    const many = Array.from({ length: 500 }, () => spawn(1));
    expect(staffSpawnClaim(null, many, ninety).detail).toMatch(/at least/i);
  });

  it("prints no figure at all when neither read came back", () => {
    const claim = staffSpawnClaim(null, null, ninety);
    expect(claim.items).toBeNull();
    expect(claim.detail).toMatch(/could not be read/i);
  });
});
