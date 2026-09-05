import { describe, expect, it } from "vitest";

import fixture from "./bcrypt-fixture.json";
import {
  BCRYPT_COST,
  hashPassword,
  hashPasswordWithSalt,
  verifyPassword,
} from "./hash";
import { fakeSalt, saltOf } from "./salt";

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

describe("hashPasswordWithSalt, the salt handshake", () => {
  it("reproduces each fixture hash from its own salt", async () => {
    // The property the whole login flow rests on: given only the salt, this
    // side can compute the exact 60 characters the database is holding. If
    // bcrypt-ts ever stopped honouring a passed-in salt, every login would
    // fail with "wrong password" and nothing else would say why.
    for (const entry of fixture.hashes) {
      const salt = saltOf(entry.hash) as string;
      expect(await hashPasswordWithSalt(fixture.password, salt)).toBe(
        entry.hash,
      );
    }
  });

  it("folds case, like hashPassword", async () => {
    for (const entry of fixture.hashes) {
      const salt = saltOf(entry.hash) as string;
      expect(
        await hashPasswordWithSalt(fixture.password.toUpperCase(), salt),
      ).toBe(entry.hash);
    }
  });

  it("gives a different answer for a different password", async () => {
    const salt = saltOf(fixture.hashes[0].hash) as string;
    expect(await hashPasswordWithSalt("hunter3", salt)).not.toBe(
      fixture.hashes[0].hash,
    );
  });

  it("produces a candidate the database can compare: 60 characters", async () => {
    const salt = fakeSalt("a".repeat(32), "nosuchplayer");
    const candidate = await hashPasswordWithSalt("anything", salt);
    expect(candidate).toHaveLength(60);
    expect(candidate.startsWith(salt)).toBe(true);
  });
});
