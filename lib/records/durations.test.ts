import { describe, expect, it } from "vitest";

import { DEFAULT_DURATION, RECORD_DURATIONS, recordDuration } from "./durations";

/**
 * The list itself, not the pages that read it.
 *
 * `npm run db:check` is what proves this agrees with
 * `accounts.record_durations()` in the live database; these are the properties
 * the pages assume of it whether or not a database is reachable.
 */

describe("the durations we run", () => {
  it("is five minutes, six hours and twenty-four hours", () => {
    expect(RECORD_DURATIONS.map((duration) => duration.seconds)).toEqual([300, 21600, 86400]);
  });

  it("is ordered shortest first, because that is the order they are offered in", () => {
    const seconds = RECORD_DURATIONS.map((duration) => duration.seconds);
    expect([...seconds].sort((a, b) => a - b)).toEqual(seconds);
  });

  it("gives every one of them two seconds of grace, as migration 9 does", () => {
    // The world's tick and the hop to the login server, and nothing for a
    // player still in combat at 0:00. db:check is what proves the database
    // agrees; this is what stops a duration being added with a grace of its own.
    for (const duration of RECORD_DURATIONS) {
      expect(duration.graceSeconds).toBe(2);
    }
  });

  it("defaults to six hours, because five minutes is the one we test with", () => {
    expect(DEFAULT_DURATION.seconds).toBe(21600);
    expect(RECORD_DURATIONS).toContain(DEFAULT_DURATION);
  });

  it("names each one once: the words are how the tabs and headings tell them apart", () => {
    const labels = RECORD_DURATIONS.map((duration) => duration.label);
    const adjectives = RECORD_DURATIONS.map((duration) => duration.adjective);

    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(adjectives).size).toBe(adjectives.length);
    for (const word of [...labels, ...adjectives]) {
      expect(word).not.toBe("");
    }
  });

  it("finds one by its seconds, and nothing by anything else", () => {
    for (const duration of RECORD_DURATIONS) {
      expect(recordDuration(duration.seconds)).toBe(duration);
    }
    // The gaps between them are not durations: `record_start` refuses them too.
    expect(recordDuration(600)).toBeNull();
    expect(recordDuration(3600)).toBeNull();
    expect(recordDuration(604800)).toBeNull();
  });
});
