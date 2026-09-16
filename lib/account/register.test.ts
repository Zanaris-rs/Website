import { describe, expect, it } from "vitest";

import { agentHash } from "./agent";
import { parseRegisterRow, registerStatement, statusFor } from "./register";

const input = {
  code: "VTPVXVR14D2PF2DB",
  username: "bob",
  email: "bob@example.com",
  emailNormalized: "bob@example.com",
  passwordHash: "$2b$10$abcdefghijklmnopqrstuv",
  ip: "203.0.113.7",
  ipGroup: "203.0.113.0/24",
  agentHash: "deadbeef",
};

describe("registerStatement", () => {
  it("is one call to register_with_invite, code first", () => {
    const statement = registerStatement(input);
    expect(statement.text).toBe(
      "select * from accounts.register_with_invite($1, $2, $3, $4, $5, $6, $7, $8)",
    );
    expect(statement.values).toEqual([
      "VTPVXVR14D2PF2DB",
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

  it("never calls the old open door", () => {
    expect(registerStatement(input).text).not.toContain("accounts.register(");
  });
});

describe("parseRegisterRow", () => {
  it("reads a new citizen", () => {
    expect(parseRegisterRow({ result: "ok", citizen_number: 42 })).toEqual({
      result: "ok",
      citizenNumber: 42,
    });
  });

  it("accepts every refusal, with no number", () => {
    for (const result of [
      "invite_invalid",
      "invite_claimed",
      "invite_expired",
      "invite_revoked",
      "username_taken",
      "rate_limited",
    ] as const) {
      expect(parseRegisterRow({ result, citizen_number: null })).toEqual({
        result,
        citizenNumber: null,
      });
    }
  });

  it("throws on anything else rather than guessing", () => {
    for (const bad of [
      null,
      undefined,
      {},
      { result: "OK" },
      { result: "ok", citizen_number: null },
      { result: "ok", citizen_number: "42" },
    ]) {
      expect(() => parseRegisterRow(bad)).toThrow();
    }
  });
});

describe("statusFor", () => {
  it("maps each answer to its status", () => {
    expect(statusFor("ok")).toBe(200);
    expect(statusFor("username_taken")).toBe(409);
    expect(statusFor("invite_invalid")).toBe(409);
    expect(statusFor("invite_claimed")).toBe(409);
    expect(statusFor("invite_expired")).toBe(409);
    expect(statusFor("invite_revoked")).toBe(409);
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
