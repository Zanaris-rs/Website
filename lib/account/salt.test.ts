import { hash } from "bcrypt-ts";
import { describe, expect, it } from "vitest";

import fixture from "./bcrypt-fixture.json";
import { hashPassword, hashPasswordWithSalt } from "./hash";
import {
  BCRYPT_HASH_LENGTH,
  BCRYPT_SALT_LENGTH,
  bcryptBase64,
  fakeSalt,
  isBcryptHash,
  isBcryptSalt,
  saltOf,
  sessionVersion,
} from "./salt";

const SECRET = "a".repeat(32);

describe("bcrypt salt and hash shapes", () => {
  it("accepts the fixture hashes and their salts", () => {
    for (const entry of fixture.hashes) {
      expect(entry.hash).toHaveLength(BCRYPT_HASH_LENGTH);
      expect(isBcryptHash(entry.hash)).toBe(true);

      const salt = saltOf(entry.hash);
      expect(salt).not.toBeNull();
      expect(salt).toHaveLength(BCRYPT_SALT_LENGTH);
      expect(isBcryptSalt(salt)).toBe(true);
    }
  });

  it("rejects anything that is not a bcrypt string", () => {
    for (const bad of [
      "",
      "not a hash",
      "$2b$10$",
      // 22 characters of the wrong alphabet: `+` is standard base64, not bcrypt's.
      "$2b$10$++++++++++++++++++++++",
      // A whole hash is not a salt.
      fixture.hashes[0].hash,
      null,
      undefined,
      42,
    ]) {
      expect(isBcryptSalt(bad)).toBe(false);
    }

    // ...and a salt is not a whole hash.
    expect(isBcryptHash(saltOf(fixture.hashes[0].hash))).toBe(false);
    expect(saltOf("nonsense")).toBeNull();
  });
});

describe("bcryptBase64", () => {
  it("turns 16 bytes into 22 characters of bcrypt's alphabet", () => {
    const encoded = bcryptBase64(new Uint8Array(16));
    expect(encoded).toHaveLength(22);
    // All-zero bytes encode to the first character of the alphabet, `.`.
    expect(encoded).toBe(".".repeat(22));
  });

  it("uses bcrypt's alphabet, not the standard one", () => {
    const bytes = new Uint8Array(16);
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = i * 16 + i;
    expect(bcryptBase64(bytes)).toMatch(/^[./A-Za-z0-9]{22}$/);
    // Standard base64 of these bytes contains `+`, which bcrypt never emits.
    expect(bcryptBase64(bytes)).not.toContain("+");
  });
});

describe("fakeSalt", () => {
  it("looks exactly like a real salt", () => {
    const salt = fakeSalt(SECRET, "nosuchplayer");
    expect(salt).toHaveLength(BCRYPT_SALT_LENGTH);
    expect(isBcryptSalt(salt)).toBe(true);
    expect(salt.startsWith("$2b$10$")).toBe(true);
  });

  it("is canonical: bcrypt hashes with it and gives it back unchanged", async () => {
    // The whole point of the encoder. A non-canonical 22 characters would
    // decode to the same 16 bytes and re-encode to a different string, and the
    // resulting hash would not begin with the salt we passed in.
    const salt = fakeSalt(SECRET, "nosuchplayer");
    const hashed = await hash("whatever they typed", salt);
    expect(hashed.startsWith(salt)).toBe(true);
    expect(saltOf(hashed)).toBe(salt);
  });

  it("is stable per username, so repeated probes cannot be told apart", () => {
    expect(fakeSalt(SECRET, "bob")).toBe(fakeSalt(SECRET, "bob"));
    expect(fakeSalt(SECRET, "bob")).not.toBe(fakeSalt(SECRET, "bob_smith"));
  });

  it("is keyed by the secret, so it cannot be precomputed", () => {
    expect(fakeSalt(SECRET, "bob")).not.toBe(fakeSalt("b".repeat(32), "bob"));
  });
});

describe("sessionVersion", () => {
  it("is 16 hex characters of sha256(salt)", () => {
    const salt = saltOf(fixture.hashes[0].hash) as string;
    expect(sessionVersion(salt)).toMatch(/^[0-9a-f]{16}$/);
    expect(sessionVersion(salt)).toBe(sessionVersion(salt));
  });

  it("changes when the salt does — which is what logs other devices out", () => {
    const a = saltOf(fixture.hashes[0].hash) as string;
    const b = fakeSalt(SECRET, "someone else");
    expect(sessionVersion(a)).not.toBe(sessionVersion(b));
  });
});

/**
 * The routes guard on `isBcryptHash(candidate)` before handing anything to
 * `accounts.login` or `accounts.change_password`. That guard is only worth
 * having if it accepts every hash the real hashing path produces — otherwise
 * it would turn a correct password into a 503.
 */
describe("isBcryptHash, as the routes use it", () => {
  it("accepts a candidate built from a real stored salt", async () => {
    for (const entry of fixture.hashes) {
      const salt = saltOf(entry.hash) as string;
      const candidate = await hashPasswordWithSalt(fixture.password, salt);
      expect(isBcryptHash(candidate)).toBe(true);
      expect(candidate).toHaveLength(BCRYPT_HASH_LENGTH);
    }
  });

  it("accepts a candidate built from a fake salt", async () => {
    // The unknown-username path has to reach the database looking exactly like
    // the real one, or the guard would leak which names exist by answering 503
    // for some and 401 for others.
    const candidate = await hashPasswordWithSalt(
      "whatever they typed",
      fakeSalt(SECRET, "nosuchplayer"),
    );
    expect(isBcryptHash(candidate)).toBe(true);
  });

  it("accepts a freshly generated hash, which is what a new password is", async () => {
    expect(isBcryptHash(await hashPassword("hunter22"))).toBe(true);
  });

  it("rejects the things that would otherwise reach the SQL call", () => {
    for (const bad of [
      "",
      "not a hash",
      // A salt is not a hash: 29 characters, not 60.
      fakeSalt(SECRET, "nosuchplayer"),
      // Right length, wrong alphabet.
      "$2b$10$" + "+".repeat(53),
      // Right shape, one character short.
      fixture.hashes[0].hash.slice(0, 59),
      fixture.hashes[0].hash + "x",
      null,
      undefined,
    ]) {
      expect(isBcryptHash(bad)).toBe(false);
    }
  });
});
