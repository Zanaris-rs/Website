import { describe, expect, it } from "vitest";

import {
  changeEmailStatement,
  changePasswordStatement,
  loginStatement,
  loginStatusFor,
  parseLoginResult,
  parseSalt,
  passwordSaltStatement,
  reauthStatusFor,
} from "./login";

/**
 * The SQL text is asserted character for character. That looks pedantic until
 * you remember what these statements are: the only four verbs a leaked
 * `DATABASE_URL` can perform. A stray edit that interpolated a username, or
 * that dropped a parameter and shifted the rest along, would be a live
 * injection or a silently mis-ordered call — and a passing test suite either
 * way, unless the text itself is the thing being checked.
 */
describe("the statements", () => {
  it("asks for a salt by name, in a placeholder", () => {
    expect(passwordSaltStatement("bob_smith")).toEqual({
      text: "select accounts.password_salt($1) as salt",
      values: ["bob_smith"],
    });
  });

  it("logs in with name, candidate and ip, in that order", () => {
    expect(loginStatement("bob_smith", "$2b$10$" + "x".repeat(53), "1.2.3.4"))
      .toEqual({
        text: "select accounts.login($1, $2, $3) as result",
        values: ["bob_smith", "$2b$10$" + "x".repeat(53), "1.2.3.4"],
      });
  });

  it("changes a password with the current candidate first, then the new hash", () => {
    // Swapping these two would set the password to the *old* one and report
    // success. The order is the compare-and-set.
    expect(
      changePasswordStatement("bob_smith", "current", "new", "1.2.3.4"),
    ).toEqual({
      text: "select accounts.change_password($1, $2, $3, $4) as result",
      values: ["bob_smith", "current", "new", "1.2.3.4"],
    });
  });

  it("changes an email with both the stored and the normalised form", () => {
    expect(
      changeEmailStatement(
        "bob_smith",
        "current",
        "Bob+rs@Gmail.com",
        "bob@gmail.com",
        "1.2.3.4",
      ),
    ).toEqual({
      text: "select accounts.change_email($1, $2, $3, $4, $5) as result",
      values: [
        "bob_smith",
        "current",
        "Bob+rs@Gmail.com",
        "bob@gmail.com",
        "1.2.3.4",
      ],
    });
  });

  it("never interpolates: every value is a placeholder", () => {
    const nasty = "'; drop table account; --";
    for (const statement of [
      passwordSaltStatement(nasty),
      loginStatement(nasty, nasty, nasty),
      changePasswordStatement(nasty, nasty, nasty, nasty),
      changeEmailStatement(nasty, nasty, nasty, nasty, nasty),
    ]) {
      expect(statement.text).not.toContain(nasty);
      expect(statement.text).not.toContain("drop table");
      expect(statement.values).toContain(nasty);
    }
  });

  it("passes no `name`, so the transaction pooler never sees a prepare", () => {
    for (const statement of [
      passwordSaltStatement("a"),
      loginStatement("a", "b", "c"),
      changePasswordStatement("a", "b", "c", "d"),
      changeEmailStatement("a", "b", "c", "d", "e"),
    ]) {
      expect(Object.keys(statement).sort()).toEqual(["text", "values"]);
    }
  });
});

describe("parseSalt", () => {
  it("returns the salt when there is one", () => {
    expect(parseSalt("$2b$10$abcdefghijklmnopqrstuv")).toBe(
      "$2b$10$abcdefghijklmnopqrstuv",
    );
  });

  it("is null for a NULL, a missing row or an empty string", () => {
    // All three take the fake-salt path, and the caller must not be able to
    // tell them apart — that is the no-username-oracle property.
    expect(parseSalt(null)).toBeNull();
    expect(parseSalt(undefined)).toBeNull();
    expect(parseSalt("")).toBeNull();
    expect(parseSalt(42)).toBeNull();
  });
});

describe("parseLoginResult", () => {
  it("accepts the three answers the function can give", () => {
    expect(parseLoginResult("ok")).toBe("ok");
    expect(parseLoginResult("bad_credentials")).toBe("bad_credentials");
    expect(parseLoginResult("rate_limited")).toBe("rate_limited");
  });

  it("throws on anything else, rather than guessing", () => {
    // A 503 an operator can find beats a silent "wrong password" for everyone.
    for (const bad of [null, undefined, "", "OK", "true", 1, {}]) {
      expect(() => parseLoginResult(bad)).toThrow(/accounts\.login returned/);
    }
  });
});

describe("the status mapping", () => {
  it("is 200 / 401 / 429 at the login form", () => {
    expect(loginStatusFor("ok")).toBe(200);
    expect(loginStatusFor("bad_credentials")).toBe(401);
    expect(loginStatusFor("rate_limited")).toBe(429);
  });

  it("is 200 / 403 / 429 when re-typing a password while signed in", () => {
    // 401 would mean "log in", and they already have: the session is fine and
    // it is the typed password that was wrong.
    expect(reauthStatusFor("ok")).toBe(200);
    expect(reauthStatusFor("bad_credentials")).toBe(403);
    expect(reauthStatusFor("rate_limited")).toBe(429);
  });
});
