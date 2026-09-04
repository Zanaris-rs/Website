import { describe, expect, it } from "vitest";

import fixture from "./bcrypt-fixture.json";
import { BCRYPT_COST, hashPassword, verifyPassword } from "./hash";

/**
 * The contract that spans two repos: `bcrypt(password.toLowerCase(), 10)`.
 *
 * Get this wrong and every account created through the website is unloggable,
 * and it fails *silently at login* — nowhere near the code that caused it.
 * bcrypt salts randomly, so the two fixture hashes are different strings; what
 * has to hold is that each verifies from the other side.
 */
describe("password hashing, against the engine's fixture", () => {
  for (const entry of fixture.hashes) {
    it(`verifies the ${entry.source} hash`, async () => {
      expect(await verifyPassword(fixture.password, entry.hash)).toBe(true);
    });

    it(`verifies the ${entry.source} hash case-insensitively`, async () => {
      // The 2004 login protocol upper-cases nothing and lower-cases nothing;
      // the engine folds the case itself, so both spellings must let a player in.
      expect(
        await verifyPassword(fixture.password.toLowerCase(), entry.hash),
      ).toBe(true);
      expect(
        await verifyPassword(fixture.password.toUpperCase(), entry.hash),
      ).toBe(true);
    });

    it(`rejects a different password against the ${entry.source} hash`, async () => {
      expect(await verifyPassword("hunter3", entry.hash)).toBe(false);
    });

    it(`uses cost ${fixture.cost} in the ${entry.source} hash`, () => {
      expect(entry.hash.startsWith(`$2b$${fixture.cost}$`)).toBe(true);
    });
  }

  it("has an entry from each side, or the test proves nothing", () => {
    const sources = fixture.hashes.map((entry) => entry.source);
    // The one the engine repo published; without it this file would only be
    // checking that bcrypt agrees with itself.
    expect(sources).toContain("engine-published");
    expect(sources).toContain("engine");
    expect(sources).toContain("website");
  });
});

describe("hashPassword", () => {
  it("produces a hash the fixture's rules accept", async () => {
    const hash = await hashPassword("Hunter2");
    expect(hash.startsWith(`$2b$${BCRYPT_COST}$`)).toBe(true);
    expect(await verifyPassword("hunter2", hash)).toBe(true);
    expect(await verifyPassword("HUNTER2", hash)).toBe(true);
    expect(await verifyPassword("hunter", hash)).toBe(false);
  });

  it("salts, so two hashes of one password differ", async () => {
    expect(await hashPassword("Hunter2")).not.toBe(await hashPassword("Hunter2"));
  });
});
