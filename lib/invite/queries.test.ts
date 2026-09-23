import { describe, expect, it } from "vitest";

import {
  citizenStatement,
  inviteCreateStatement,
  invitePreviewStatement,
  inviteRevokeStatement,
  inviteStatusFor,
  invitesStatement,
  parseCitizen,
  parseGenealogyRow,
  parseInviteCreated,
  parseInvitePreview,
  parseInviteRevokeResult,
  parseInviteRow,
  parseInviterRow,
  parseStaffSetInvitesResult,
  parseTreeRow,
  staffInviteGenealogyStatement,
  staffInviteTreeStatement,
  staffInvitersStatement,
  staffSetInvitesStatement,
} from "./queries";

const CODE = "VTPVXVR14D2PF2DB";
const HASH = `$2b$10$${"a".repeat(53)}`;

describe("statements", () => {
  it("call migration 6's functions positionally and interpolate nothing", () => {
    const hostile = "'); drop table invite; --";
    const cases = [
      [invitePreviewStatement(hostile, "203.0.113.7"), "select * from accounts.invite_preview($1, $2)", [hostile, "203.0.113.7"]],
      [inviteCreateStatement(hostile, CODE), "select * from accounts.invite_create($1, $2)", [hostile, CODE]],
      [inviteRevokeStatement(hostile, CODE), "select accounts.invite_revoke($1, $2) as result", [hostile, CODE]],
      [invitesStatement(hostile), "select * from accounts.invites($1)", [hostile]],
      [citizenStatement(hostile), "select * from accounts.citizen($1)", [hostile]],
      [staffSetInvitesStatement("mod", HASH, hostile, false), "select accounts.staff_set_invites($1, $2, $3, $4) as result", ["mod", HASH, hostile, false]],
      [staffInviteTreeStatement("mod", hostile), "select * from accounts.staff_invite_tree($1, $2)", ["mod", hostile]],
      [staffInvitersStatement(hostile), "select * from accounts.staff_inviters($1)", [hostile]],
    ] as const;

    for (const [statement, text, values] of cases) {
      expect(statement.text).toBe(text);
      expect(statement.values).toEqual(values);
      expect(statement.text).not.toContain("drop table");
    }
  });
});

describe("parseInvitePreview", () => {
  it("keeps the inviter only for a live link", () => {
    expect(parseInvitePreview({ result: "ok", inviter: "rakemage" })).toEqual({
      result: "ok",
      inviter: "rakemage",
    });
    expect(parseInvitePreview({ result: "claimed", inviter: "rakemage" })).toEqual({
      result: "claimed",
      inviter: null,
    });
  });

  it("accepts every documented answer", () => {
    for (const result of ["not_found", "claimed", "revoked", "expired", "rate_limited"]) {
      expect(parseInvitePreview({ result, inviter: null }).result).toBe(result);
    }
  });

  it("throws on a contract break", () => {
    for (const bad of [undefined, null, {}, { result: "OK" }, { result: "ok", inviter: null }]) {
      expect(() => parseInvitePreview(bad)).toThrow();
    }
  });
});

describe("parseInviteCreated", () => {
  it("reads the code and the expiry as an ISO string", () => {
    expect(
      parseInviteCreated({
        result: "ok",
        code: CODE,
        expires_at: new Date("2026-09-30T12:00:00Z"),
      }),
    ).toEqual({ result: "ok", code: CODE, expiresAt: "2026-09-30T12:00:00.000Z" });
  });

  it("accepts the refusals with no code", () => {
    for (const result of ["invalid", "disabled", "too_many", "retry"]) {
      expect(parseInviteCreated({ result, code: null, expires_at: null })).toEqual({
        result,
        code: null,
        expiresAt: null,
      });
    }
  });

  it("throws on a contract break", () => {
    expect(() => parseInviteCreated({ result: "ok", code: null, expires_at: null })).toThrow();
    expect(() => parseInviteCreated({ result: "nope" })).toThrow();
    expect(() => parseInviteCreated(undefined)).toThrow();
  });
});

describe("parseInviteRevokeResult", () => {
  it("accepts the three answers and nothing else", () => {
    for (const result of ["ok", "not_found", "already_claimed"]) {
      expect(parseInviteRevokeResult(result)).toBe(result);
    }
    expect(() => parseInviteRevokeResult("forbidden")).toThrow();
  });
});

describe("parseInviteRow", () => {
  it("reads one link", () => {
    expect(
      parseInviteRow({
        code: CODE,
        created_at: new Date("2026-09-16T00:00:00Z"),
        expires_at: new Date("2026-09-30T00:00:00Z"),
        state: "claimed",
        claimed_by: "bob",
        claimed_at: new Date("2026-09-17T00:00:00Z"),
      }),
    ).toEqual({
      code: CODE,
      createdAt: "2026-09-16T00:00:00.000Z",
      expiresAt: "2026-09-30T00:00:00.000Z",
      state: "claimed",
      claimedBy: "bob",
      claimedAt: "2026-09-17T00:00:00.000Z",
    });
  });

  it("drops a row it cannot trust", () => {
    expect(parseInviteRow({ code: "short", state: "live" })).toBeNull();
    expect(parseInviteRow({ code: CODE, state: "pending", created_at: new Date(), expires_at: new Date() })).toBeNull();
    expect(parseInviteRow(null)).toBeNull();
  });
});

describe("parseCitizen", () => {
  it("reads the header row", () => {
    expect(parseCitizen({ citizen_number: 42, invites_enabled: false, invited_by: "rakemage" })).toEqual({
      citizenNumber: 42,
      invitesEnabled: false,
      invitedBy: "rakemage",
    });
    expect(parseCitizen({ citizen_number: 1, invites_enabled: true, invited_by: null })).toEqual({
      citizenNumber: 1,
      invitesEnabled: true,
      invitedBy: null,
    });
  });

  it("treats anything odd as no row, and never as enabled", () => {
    expect(parseCitizen(undefined)).toBeNull();
    expect(parseCitizen({ citizen_number: "42", invites_enabled: true })).toBeNull();
    expect(parseCitizen({ citizen_number: 42, invites_enabled: "true" })).toBeNull();
  });
});

describe("staff parsers", () => {
  it("accepts the staff_set_invites answers and nothing else", () => {
    for (const result of ["ok", "forbidden", "bad_credentials", "rate_limited", "not_found", "invalid"]) {
      expect(parseStaffSetInvitesResult(result)).toBe(result);
    }
    expect(() => parseStaffSetInvitesResult("disabled")).toThrow();
  });

  it("reads a tree row", () => {
    expect(
      parseTreeRow({
        relation: "invited_by",
        username: "rakemage",
        citizen_number: 7,
        invites_enabled: true,
        happened_at: new Date("2026-09-17T00:00:00Z"),
        banned: false,
      }),
    ).toEqual({
      relation: "invited_by",
      username: "rakemage",
      citizenNumber: 7,
      invitesEnabled: true,
      happenedAt: "2026-09-17T00:00:00.000Z",
      banned: false,
    });
    expect(parseTreeRow({ relation: "cousin", username: "x", citizen_number: 1 })).toBeNull();
  });

  it("reads an inviter row", () => {
    expect(
      parseInviterRow({ username: "rakemage", citizen_number: 7, live_links: 3, claimed_links: 12, banned: false }),
    ).toEqual({ username: "rakemage", citizenNumber: 7, liveLinks: 3, claimedLinks: 12, banned: false });
    expect(parseInviterRow({ username: "", citizen_number: 7 })).toBeNull();
  });
});

describe("inviteStatusFor", () => {
  it("maps each answer to a status", () => {
    expect(inviteStatusFor("ok")).toBe(200);
    expect(inviteStatusFor("invalid")).toBe(400);
    expect(inviteStatusFor("disabled")).toBe(403);
    expect(inviteStatusFor("forbidden")).toBe(403);
    expect(inviteStatusFor("bad_credentials")).toBe(403);
    expect(inviteStatusFor("not_found")).toBe(404);
    expect(inviteStatusFor("already_claimed")).toBe(409);
    expect(inviteStatusFor("too_many")).toBe(429);
    expect(inviteStatusFor("rate_limited")).toBe(429);
    expect(inviteStatusFor("something new")).toBe(500);
  });
});

describe("the genealogy", () => {
  it("calls staff_invite_genealogy with the actor alone", () => {
    expect(staffInviteGenealogyStatement("mod")).toEqual({
      text: "select * from accounts.staff_invite_genealogy($1)",
      values: ["mod"],
    });
  });

  it("reads a progenitor and an invited account", () => {
    expect(
      parseGenealogyRow({
        username: "root",
        citizen_number: 1,
        invited_by: null,
        joined_at: new Date("2026-09-01T00:00:00Z"),
        invites_enabled: true,
        banned: false,
      }),
    ).toEqual({
      username: "root",
      citizenNumber: 1,
      invitedBy: null,
      joinedAt: "2026-09-01T00:00:00.000Z",
      invitesEnabled: true,
      banned: false,
    });
    expect(
      parseGenealogyRow({ username: "kid", citizen_number: 12, invited_by: 1, banned: true }),
    ).toMatchObject({ invitedBy: 1, joinedAt: null, banned: true, invitesEnabled: false });
  });

  it("drops a row it cannot trust rather than guessing", () => {
    expect(parseGenealogyRow(null)).toBeNull();
    expect(parseGenealogyRow({ username: "", citizen_number: 1 })).toBeNull();
    expect(parseGenealogyRow({ username: "a", citizen_number: -1 })).toBeNull();
    expect(parseGenealogyRow({ username: "a", citizen_number: 2, invited_by: "1" })).toBeNull();
  });
});
