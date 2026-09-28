import { describe, expect, it } from "vitest";

import {
  CLAN_ANSWERS,
  CLAN_STATUS,
  CLAN_WRITE_RESULTS,
  clanCreateStatement,
  clanDirectoryStatement,
  clanDisbandStatement,
  clanHandOverStatement,
  clanInviteAnswerStatement,
  clanInviteCancelStatement,
  clanInvitesForStatement,
  clanInvitesSentStatement,
  clanInviteStatement,
  clanLeaveStatement,
  clanMembersStatement,
  clanNoticeDeleteStatement,
  clanNoticePostStatement,
  clanNoticesStatement,
  clanOfStatement,
  clanPageStatement,
  clanRemoveStatement,
  clanSavePageStatement,
  clanSetPermsStatement,
  clanSetRankStatement,
  clanStatusFor,
  parseClanDirectory,
  parseClanInvitesFor,
  parseClanInvitesSent,
  parseClanMembers,
  parseClanNotices,
  parseClanOf,
  parseClanPage,
  parseClanWrite,
} from "./queries";

const HOSTILE = "x'); drop table account; --";

const PAGE_ROW = {
  id: 7,
  name: "Varrock Knights",
  slug: "varrock-knights",
  motto: "For the King!",
  crest: 1333,
  world: 2,
  about: "We guard Varrock.",
  created_at: new Date("2026-09-20T10:00:00Z"),
  members: 3,
  leader: "zezima",
  perm_invite: 4,
  perm_remove: 1,
  perm_ranks: 1,
  perm_page: 2,
};

describe("read statements", () => {
  it.each([
    ["clan_page", clanPageStatement(HOSTILE), "select * from accounts.clan_page($1)", [HOSTILE]],
    ["clan_members", clanMembersStatement(7), "select * from accounts.clan_members($1)", [7]],
    ["clan_notices", clanNoticesStatement(7), "select * from accounts.clan_notices($1)", [7]],
    ["clan_directory", clanDirectoryStatement(), "select * from accounts.clan_directory()", []],
    ["clan_of", clanOfStatement(HOSTILE), "select * from accounts.clan_of($1)", [HOSTILE]],
    ["clan_invites_for", clanInvitesForStatement(HOSTILE), "select * from accounts.clan_invites_for($1)", [HOSTILE]],
    ["clan_invites_sent", clanInvitesSentStatement(HOSTILE), "select * from accounts.clan_invites_sent($1)", [HOSTILE]],
  ])("%s: its row function, the values out of the text", (_name, statement, text, values) => {
    expect(statement).toEqual({ text, values });
  });
});

describe("write statements", () => {
  it.each([
    [
      clanCreateStatement(HOSTILE, "Varrock Knights", "For the King!", 1333, null),
      "select accounts.clan_create($1, $2, $3, $4, $5) as result",
      [HOSTILE, "Varrock Knights", "For the King!", 1333, null],
    ],
    [
      clanSavePageStatement("zezima", "Varrock Knights", "", 1038, 2, HOSTILE),
      "select accounts.clan_save_page($1, $2, $3, $4, $5, $6) as result",
      ["zezima", "Varrock Knights", "", 1038, 2, HOSTILE],
    ],
    [
      clanSetPermsStatement("zezima", 4, 1, 1, 2),
      "select accounts.clan_set_perms($1, $2, $3, $4, $5) as result",
      ["zezima", 4, 1, 1, 2],
    ],
    [clanInviteStatement("zezima", HOSTILE), "select accounts.clan_invite($1, $2) as result", ["zezima", HOSTILE]],
    [
      clanInviteCancelStatement("zezima", "staffy"),
      "select accounts.clan_invite_cancel($1, $2) as result",
      ["zezima", "staffy"],
    ],
    [
      clanInviteAnswerStatement("staffy", 7, true),
      "select accounts.clan_invite_answer($1, $2, $3) as result",
      ["staffy", 7, true],
    ],
    [
      clanSetRankStatement("zezima", "nel", "general"),
      "select accounts.clan_set_rank($1, $2, $3) as result",
      ["zezima", "nel", "general"],
    ],
    [clanRemoveStatement("zezima", "mutey"), "select accounts.clan_remove($1, $2) as result", ["zezima", "mutey"]],
    [clanLeaveStatement("nel"), "select accounts.clan_leave($1) as result", ["nel"]],
    [clanHandOverStatement("zezima", "nel"), "select accounts.clan_hand_over($1, $2) as result", ["zezima", "nel"]],
    [clanDisbandStatement("zezima"), "select accounts.clan_disband($1) as result", ["zezima"]],
    [
      clanNoticePostStatement("nel", HOSTILE, "Fountain at 5"),
      "select accounts.clan_notice_post($1, $2, $3) as result",
      ["nel", HOSTILE, "Fountain at 5"],
    ],
    [clanNoticeDeleteStatement("nel", 3), "select accounts.clan_notice_delete($1, $2) as result", ["nel", 3]],
  ])("%#: passes every argument in the function's order", (statement, text, values) => {
    expect(statement).toEqual({ text, values });
    expect(statement.text).not.toContain("drop");
  });
});

describe("parseClanPage", () => {
  it("is null for an unknown slug", () => {
    expect(parseClanPage([])).toBeNull();
  });

  it("reads the clan, its thresholds as perms", () => {
    expect(parseClanPage([PAGE_ROW])).toEqual({
      id: 7,
      name: "Varrock Knights",
      slug: "varrock-knights",
      motto: "For the King!",
      crest: 1333,
      world: 2,
      about: "We guard Varrock.",
      createdAt: "2026-09-20T10:00:00.000Z",
      members: 3,
      leader: "zezima",
      perms: { invite: 4, remove: 1, ranks: 1, page: 2 },
    });
    expect(parseClanPage([{ ...PAGE_ROW, world: null, leader: null }])).toMatchObject({ world: null, leader: null });
  });

  it("throws on what migration 17 never answers", () => {
    expect(() => parseClanPage([{ ...PAGE_ROW, world: 0 }])).toThrow(/world/);
    expect(() => parseClanPage([{ ...PAGE_ROW, perm_page: 7 }])).toThrow(/perm_page/);
    expect(() => parseClanPage([{ ...PAGE_ROW, crest: 70000 }])).toThrow(/crest/);
    expect(() => parseClanPage([{ ...PAGE_ROW, members: "3" }])).toThrow(/members/);
    expect(() => parseClanPage([PAGE_ROW, PAGE_ROW])).toThrow(/at most one/);
  });
});

describe("the other reads", () => {
  it("read a roster by rank, and throw on a rank the ladder lacks", () => {
    expect(parseClanMembers([{ username: "nel", rank: "captain", joined_at: "2026-09-21T10:00:00Z" }])).toEqual([
      { username: "nel", rank: "captain", joinedAt: "2026-09-21T10:00:00.000Z" },
    ]);
    expect(() => parseClanMembers([{ username: "nel", rank: "owner", joined_at: "2026-09-21T10:00:00Z" }])).toThrow(/owner/);
  });

  it("read notices, whose author may have left", () => {
    const row = { id: 3, title: "Meet", body: "Fountain at 5", author: "nel", author_rank: "captain", created_at: "2026-09-22T10:00:00Z" };
    expect(parseClanNotices([row, { ...row, id: 2, author_rank: null }])).toEqual([
      { id: 3, title: "Meet", body: "Fountain at 5", author: "nel", authorRank: "captain", createdAt: "2026-09-22T10:00:00.000Z" },
      { id: 2, title: "Meet", body: "Fountain at 5", author: "nel", authorRank: null, createdAt: "2026-09-22T10:00:00.000Z" },
    ]);
    expect(() => parseClanNotices([{ ...row, author_rank: "friend" }])).toThrow(/friend/);
  });

  it("read the directory", () => {
    expect(
      parseClanDirectory([
        { name: "Varrock Knights", slug: "varrock-knights", motto: "", crest: 1333, members: 3, created_at: "2026-09-20T10:00:00Z" },
      ]),
    ).toEqual([
      { name: "Varrock Knights", slug: "varrock-knights", motto: "", crest: 1333, members: 3, createdAt: "2026-09-20T10:00:00.000Z" },
    ]);
    expect(() => parseClanDirectory([{ name: "x", slug: "x", motto: "", crest: 1, members: null, created_at: "2026-09-20" }])).toThrow(/members/);
  });

  it("read a player's clan: none, or one", () => {
    expect(parseClanOf([])).toBeNull();
    expect(parseClanOf([{ clan_id: 7, name: "Varrock Knights", slug: "varrock-knights", rank: "leader" }])).toEqual({
      clanId: 7,
      name: "Varrock Knights",
      slug: "varrock-knights",
      rank: "leader",
    });
    const row = { clan_id: 7, name: "a", slug: "a", rank: "leader" };
    expect(() => parseClanOf([row, row])).toThrow(/at most one/);
  });

  it("read the invitations a player holds, and those a clan sent", () => {
    const held = {
      clan_id: 7, name: "Varrock Knights", slug: "varrock-knights", motto: "For the King!", crest: 1333, members: 3,
      invited_by: "zezima", invited_by_rank: "leader", created_at: "2026-09-23T10:00:00Z",
    };
    expect(parseClanInvitesFor([held, { ...held, invited_by_rank: null }])).toEqual([
      {
        clanId: 7, name: "Varrock Knights", slug: "varrock-knights", motto: "For the King!", crest: 1333, members: 3,
        invitedBy: "zezima", invitedByRank: "leader", createdAt: "2026-09-23T10:00:00.000Z",
      },
      {
        clanId: 7, name: "Varrock Knights", slug: "varrock-knights", motto: "For the King!", crest: 1333, members: 3,
        invitedBy: "zezima", invitedByRank: null, createdAt: "2026-09-23T10:00:00.000Z",
      },
    ]);
    expect(parseClanInvitesSent([{ username: "staffy", invited_by: "zezima", created_at: "2026-09-23T10:00:00Z" }])).toEqual([
      { username: "staffy", invitedBy: "zezima", createdAt: "2026-09-23T10:00:00.000Z" },
    ]);
    expect(() => parseClanInvitesSent([{ username: 5, invited_by: "zezima", created_at: "2026-09-23" }])).toThrow(/username/);
  });
});

describe("answers", () => {
  it("are every code the spec's writes give, and nothing else", () => {
    expect(CLAN_WRITE_RESULTS).toEqual([
      "ok", "not_found", "banned", "muted", "not_member", "forbidden", "leader",
      "bad_name", "bad_motto", "bad_crest", "bad_world", "bad_about", "bad_perm", "bad_rank", "bad_title", "bad_body", "self",
      "no_such_player", "no_such_member", "no_invite", "no_notice",
      "taken", "in_clan", "already", "full", "too_many",
      "rate_limited",
    ]);
    for (const result of CLAN_WRITE_RESULTS) expect(parseClanWrite(result, "clan_x")).toBe(result);
    expect(() => parseClanWrite("maybe", "clan_x")).toThrow(/maybe/);
    expect(CLAN_ANSWERS.parse).toBe(parseClanWrite);
  });

  it("map to a status by the header's rule", () => {
    const forbidding = ["banned", "muted", "forbidden", "leader", "not_member"];
    for (const result of CLAN_WRITE_RESULTS) {
      const expected =
        result === "ok" ? 200
        : /^bad_/.test(result) || result === "self" ? 400
        : forbidding.includes(result) ? 403
        : result === "not_found" || /^no_/.test(result) ? 404
        : result === "rate_limited" ? 429
        : 409;
      expect([result, CLAN_STATUS[result]]).toEqual([result, expected]);
      expect(clanStatusFor(result)).toBe(expected);
    }
    expect(clanStatusFor("surprise")).toBe(500);
  });
});
