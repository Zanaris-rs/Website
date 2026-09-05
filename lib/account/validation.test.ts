import { describe, expect, it } from "vitest";

import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  canonicalizeUsername,
  validatePassword,
  validateUsername,
} from "./validation";

describe("validateUsername", () => {
  it("canonicalises to the name the game will store", () => {
    expect(validateUsername("Bob Smith")).toEqual({
      ok: true,
      value: "bob_smith",
    });
  });

  it("strips trailing underscores, which is what the form must warn about", () => {
    expect(validateUsername("bob_")).toEqual({ ok: true, value: "bob" });
  });

  it("accepts the full 12 characters and rejects 13", () => {
    expect(validateUsername("abcdefghijkl")).toEqual({
      ok: true,
      value: "abcdefghijkl",
    });
    expect(validateUsername("abcdefghijklm")).toEqual({
      ok: false,
      error: "username_format",
    });
  });

  it("rejects characters the login screen cannot send", () => {
    for (const bad of ["bob!", "bob-smith", "bób", "bob.smith", ""]) {
      expect(validateUsername(bad)).toEqual({
        ok: false,
        error: "username_format",
      });
    }
  });

  it("rejects a name that encodes to nothing", () => {
    expect(validateUsername("_")).toEqual({
      ok: false,
      error: "username_unencodable",
    });
    expect(validateUsername("___")).toEqual({
      ok: false,
      error: "username_unencodable",
    });
  });

  it("rejects staff impersonations", () => {
    for (const bad of [
      "jagex",
      "admin",
      "moderator",
      "owner",
      "system",
      "staff",
      "jmod",
      "pmod",
      "JAGEX",
      "Mod Ash",
      "mod_ash",
    ]) {
      expect(validateUsername(bad)).toEqual({
        ok: false,
        error: "username_reserved",
      });
    }
  });

  it("does not block names that merely contain a reserved word", () => {
    // `admin` is reserved; `admiral` is a name someone might reasonably want.
    expect(validateUsername("admiral")).toEqual({ ok: true, value: "admiral" });
    expect(validateUsername("modest")).toEqual({ ok: true, value: "modest" });
  });
});

describe("validatePassword", () => {
  it("accepts the documented range", () => {
    expect(validatePassword("a".repeat(PASSWORD_MIN))).toMatchObject({
      ok: true,
    });
    expect(validatePassword("a".repeat(PASSWORD_MAX))).toMatchObject({
      ok: true,
    });
  });

  it("rejects outside it", () => {
    expect(validatePassword("a".repeat(PASSWORD_MIN - 1))).toEqual({
      ok: false,
      error: "password_short",
    });
    expect(validatePassword("a".repeat(PASSWORD_MAX + 1))).toEqual({
      ok: false,
      error: "password_long",
    });
  });

  it("rejects characters the client cannot type", () => {
    expect(validatePassword("pässwörd")).toEqual({
      ok: false,
      error: "password_charset",
    });
    expect(validatePassword("pass\nword")).toEqual({
      ok: false,
      error: "password_charset",
    });
  });

  it("keeps punctuation and spaces, which the client can send", () => {
    expect(validatePassword("p@ss w0rd!")).toMatchObject({ ok: true });
  });

  it("does not care about case, because the hash will not", () => {
    expect(validatePassword("HUNTER22")).toMatchObject({ ok: true });
  });
});

describe("canonicalizeUsername, the login rule", () => {
  it("canonicalises exactly like validateUsername", () => {
    for (const raw of ["Bob Smith", "bob_", "  Zezima  ", "A"]) {
      expect(canonicalizeUsername(raw)).toEqual(validateUsername(raw));
    }
  });

  it("applies the same format and encodability rules", () => {
    expect(canonicalizeUsername("bob!")).toEqual({
      ok: false,
      error: "username_format",
    });
    expect(canonicalizeUsername("_")).toEqual({
      ok: false,
      error: "username_unencodable",
    });
  });

  it("lets the reserved names through, because staff have to log in", () => {
    // `mod_ash` is a name nobody may register and an account somebody has:
    // refusing it here would lock the staff out of their own account centre.
    expect(canonicalizeUsername("mod_ash")).toEqual({
      ok: true,
      value: "mod_ash",
    });
    expect(validateUsername("mod_ash")).toEqual({
      ok: false,
      error: "username_reserved",
    });

    expect(canonicalizeUsername("Admin")).toEqual({ ok: true, value: "admin" });
    expect(validateUsername("Admin")).toEqual({
      ok: false,
      error: "username_reserved",
    });
  });
});
