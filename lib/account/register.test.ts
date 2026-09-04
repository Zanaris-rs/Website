import { describe, expect, it } from "vitest";

import { agentHash } from "./agent";
import { parseRegisterResult, registerStatement, statusFor } from "./register";

const input = {
  username: "bob",
  email: "bob@example.com",
  emailNormalized: "bob@example.com",
  passwordHash: "$2b$10$abcdefghijklmnopqrstuv",
  ip: "203.0.113.7",
  ipGroup: "203.0.113.0/24",
  agentHash: "deadbeef",
};

describe("registerStatement", () => {
  it("is one call, in the function's argument order", () => {
    const statement = registerStatement(input);
    expect(statement.text).toBe(
      "select accounts.register($1, $2, $3, $4, $5, $6, $7) as result",
    );
    expect(statement.values).toEqual([
      "bob",
      "bob@example.com",
      "bob@example.com",
      "$2b$10$abcdefghijklmnopqrstuv",
      "203.0.113.7",
      "203.0.113.0/24",
      "deadbeef",
    ]);
  });

  it("interpolates nothing", () => {
    const statement = registerStatement({
      ...input,
      username: "'); drop table account; --",
    });
    expect(statement.text).not.toContain("drop table");
  });
});

describe("parseRegisterResult", () => {
  it("accepts the three documented answers", () => {
    for (const result of ["ok", "username_taken", "rate_limited"] as const) {
      expect(parseRegisterResult(result)).toBe(result);
    }
  });

  it("throws on anything else rather than guessing", () => {
    // A contract break must not read as a rejection, and must never read as
    // a success.
    for (const bad of [null, undefined, "", "OK", 1, { result: "ok" }]) {
      expect(() => parseRegisterResult(bad)).toThrow();
    }
  });
});

describe("statusFor", () => {
  it("maps each answer to its status", () => {
    expect(statusFor("ok")).toBe(200);
    expect(statusFor("username_taken")).toBe(409);
    expect(statusFor("rate_limited")).toBe(429);
  });
});

describe("agentHash", () => {
  it("is a stable sha256, so identical clients collide", () => {
    expect(agentHash("Mozilla/5.0")).toBe(agentHash("Mozilla/5.0"));
    expect(agentHash("Mozilla/5.0")).toHaveLength(64);
    expect(agentHash("Mozilla/5.0")).not.toBe(agentHash("curl/8"));
  });

  it("handles a missing header", () => {
    expect(agentHash(null)).toBe(agentHash(""));
    expect(agentHash(undefined)).toHaveLength(64);
  });

  it("does not keep the raw string", () => {
    expect(agentHash("Mozilla/5.0")).not.toContain("Mozilla");
  });
});
