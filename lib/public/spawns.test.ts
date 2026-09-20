import { describe, expect, it } from "vitest";

import { ECONOMY_WINDOWS, type StaffSpawn } from "./queries";
import { type SpawnRecord, staffSpawnClaim } from "./spawns";

const ninety = ECONOMY_WINDOWS[3];
const spawn = (count: number): StaffSpawn => ({
  createdAt: "2026-09-10T00:00:00.000Z",
  itemId: 995,
  count,
  world: 1,
});

/** A record with the scope stated, because nothing may infer it. */
const record = (over: Partial<SpawnRecord> = {}): SpawnRecord => ({
  total: null,
  spawns: null,
  allTime: false,
  ...over,
});

const empty = { spawns: 0, items: 0, firstAt: null, lastAt: null };

describe("staffSpawnClaim", () => {
  it("says nought, ever, when the whole table has been read and is empty", () => {
    const claim = staffSpawnClaim(
      record({ total: empty, spawns: [], allTime: true }),
      ninety,
    );
    expect(claim.items).toBe(0);
    expect(claim.allTime).toBe(true);
    expect(claim.label).toBe("items ever created by staff");
  });

  it("dates an empty log from the day it began, which is the day the server opened", () => {
    const claim = staffSpawnClaim(
      record({ total: empty, spawns: [], allTime: true }),
      ninety,
    );
    // "Nothing, ever" means nothing without a date to measure it from.
    expect(claim.detail).toContain("5 September 2026");
    // A launch date is a day, not an instant. Formatting it with a time
    // invents a midnight nobody recorded and nothing happened at.
    expect(claim.detail).not.toContain("UTC");
  });

  it("counts objects rather than rows, because one row can be a thousand coins", () => {
    const claim = staffSpawnClaim(
      record({
        total: {
          spawns: 2,
          items: 1500,
          firstAt: "2026-09-05T00:00:00.000Z",
          lastAt: null,
        },
        allTime: true,
      }),
      ninety,
    );
    expect(claim.items).toBe(1500);
    expect(claim.detail).toContain("2");
  });

  // The aggregate and the rows are two reads of the same table and either can
  // fail on its own. Losing the aggregate loses the tidy figure, not the scope
  // of what was read, and a claim that quietly shrank to ninety days while
  // holding every row would be a different claim wearing the same words.
  it("still says ever when the aggregate failed but every row came back", () => {
    const claim = staffSpawnClaim(
      record({ total: null, spawns: [spawn(3), spawn(4)], allTime: true }),
      ninety,
    );
    expect(claim.allTime).toBe(true);
    expect(claim.label).toBe("items ever created by staff");
    expect(claim.items).toBe(7);
  });

  it("never warns of a five-hundred-row ceiling on a read that has none", () => {
    const many = Array.from({ length: 500 }, () => spawn(1));
    const claim = staffSpawnClaim(
      record({ total: null, spawns: many, allTime: true }),
      ninety,
    );
    expect(claim.detail).not.toMatch(/at least/i);
  });

  it("falls back to the window when the all-time read is not there", () => {
    const claim = staffSpawnClaim(
      record({ spawns: [spawn(3), spawn(4)] }),
      ninety,
    );
    expect(claim.items).toBe(7);
    expect(claim.allTime).toBe(false);
    expect(claim.label).toBe("items created by staff in the last 90 days");
  });

  it("never claims nought for a window when it cannot see the whole table", () => {
    const claim = staffSpawnClaim(record({ spawns: [] }), ninety);
    expect(claim.items).toBe(0);
    expect(claim.allTime).toBe(false);
    expect(claim.label).toContain("the last 90 days");
  });

  // The page prints `detail` under the figure and has nothing of its own to
  // say, so a null here is a blank line at best and a sentence contradicting
  // the figure above it at worst. A windowed claim always qualifies itself.
  it("qualifies every windowed claim, so nothing under it has to guess", () => {
    expect(staffSpawnClaim(record({ spawns: [] }), ninety).detail).toMatch(
      /last 90 days/i,
    );

    const some = staffSpawnClaim(record({ spawns: [spawn(7)] }), ninety);
    expect(some.detail).not.toBeNull();
    expect(some.detail).not.toMatch(/nothing/i);
  });

  it("says the fallback list was cut off rather than printing a short total", () => {
    const many = Array.from({ length: 500 }, () => spawn(1));
    expect(staffSpawnClaim(record({ spawns: many }), ninety).detail).toMatch(
      /at least/i,
    );
  });

  it("prints no figure at all when neither read came back", () => {
    const claim = staffSpawnClaim(record(), ninety);
    expect(claim.items).toBeNull();
    expect(claim.detail).toMatch(/could not be read/i);
  });
});
