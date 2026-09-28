import { describe, expect, it } from "vitest";

import { type ClanAction, CLAN_MESSAGES, clanFieldOf, clanMessages } from "./client";
import { CLAN_LIMITS } from "./names";
import { CLAN_WRITE_RESULTS, type ClanWriteResult } from "./queries";

/**
 * What each action's function can answer besides `ok`: migration 17's codes
 * table (Task 1), plus the codes its route refuses with before any SQL.
 */
const ACTION_CODES: Record<ClanAction, readonly ClanWriteResult[]> = {
  create: ["not_found", "banned", "muted", "bad_name", "bad_motto", "bad_crest", "bad_world", "in_clan", "taken"],
  page: [
    "not_found", "banned", "not_member", "forbidden", "bad_name", "bad_motto", "bad_crest", "bad_world", "bad_about",
    "muted", "taken",
  ],
  perms: ["not_found", "banned", "not_member", "forbidden", "bad_perm"],
  invite: [
    "not_found", "banned", "not_member", "forbidden", "no_such_player", "self", "in_clan", "already", "full", "too_many",
  ],
  cancel: ["not_found", "banned", "not_member", "forbidden", "no_invite"],
  answer: ["not_found", "banned", "no_invite", "in_clan", "full"],
  rank: ["not_found", "banned", "not_member", "forbidden", "no_such_member", "bad_rank"],
  remove: ["not_found", "banned", "not_member", "forbidden", "no_such_member", "self"],
  leave: ["not_found", "banned", "not_member", "leader"],
  handOver: ["not_found", "banned", "not_member", "forbidden", "no_such_member", "self"],
  disband: ["not_found", "banned", "not_member", "forbidden"],
  notice: ["not_found", "banned", "muted", "not_member", "forbidden", "bad_title", "bad_body", "rate_limited"],
  unnotice: ["not_found", "banned", "not_member", "no_notice", "forbidden"],
};

describe("CLAN_MESSAGES", () => {
  it("has a sentence for every refusal a clan write can give", () => {
    for (const result of CLAN_WRITE_RESULTS) {
      if (result === "ok") continue;
      expect(CLAN_MESSAGES[result], result).toMatch(/^[A-Z].*\.$/);
    }
  });

  it("gives the member and invitation limits from CLAN_LIMITS", () => {
    expect(CLAN_MESSAGES.full).toBe(`The clan is full: ${CLAN_LIMITS.members} members.`);
    expect(CLAN_MESSAGES.too_many).toBe(`Your clan already has ${CLAN_LIMITS.invites} invitations waiting for an answer.`);
    expect(clanMessages("answer").full).toBe(`That clan is full: ${CLAN_LIMITS.members} members.`);
  });

  it("reads not_found as the caller's own account: every write asks who is writing first", () => {
    expect(CLAN_MESSAGES.not_found).toBe("Your account could not be found.");
  });

  it("never says deleting a notice frees a place: deleted ones still count towards the ten a day", () => {
    expect(CLAN_MESSAGES.rate_limited).toBe("Your clan has posted 10 notices today. Try again tomorrow.");
    for (const action of Object.keys(ACTION_CODES) as ClanAction[]) {
      expect(clanMessages(action).rate_limited).not.toMatch(/delet|remov|free/i);
    }
  });
});

describe("clanMessages", () => {
  it("puts an action's own sentence before the shared one", () => {
    expect(clanMessages("invite").self).toBe("You cannot invite yourself.");
    expect(clanMessages("remove").self).toBe("You cannot remove yourself: use Leave the clan.");
    expect(clanMessages("create").in_clan).toBe("You are already in a clan. Leave it before starting one.");
    expect(clanMessages("page").self).toBe(CLAN_MESSAGES.self);
  });

  it("answers changing your own rank as forbidden, the one sentence for members you do not outrank", () => {
    expect(clanMessages("rank").forbidden).toBe("You can only change the rank of members below you.");
    expect(clanMessages("rank").self).toBe(CLAN_MESSAGES.self);
  });

  it("only overrides codes that action's write can give", () => {
    const codes = new Set<string>(CLAN_WRITE_RESULTS);
    for (const action of Object.keys(ACTION_CODES) as ClanAction[]) {
      const own = new Set<string>(ACTION_CODES[action]);
      for (const [code, sentence] of Object.entries(clanMessages(action))) {
        expect(codes.has(code), `${action} ${code}`).toBe(true);
        if (sentence !== CLAN_MESSAGES[code]) expect(own.has(code), `${action} overrides ${code}`).toBe(true);
      }
    }
  });
});

describe("the crest and the world", () => {
  it("say to pick again from the list, the only place a crest or world comes from", () => {
    expect(CLAN_MESSAGES.bad_crest).toBe("That crest cannot be used: pick another from the list.");
    expect(CLAN_MESSAGES.bad_world).toBe("That world is not on the list: pick one of the worlds, or None.");
  });
});

describe("clanFieldOf", () => {
  it("names the field of Start a clan or the Clan page that a refusal was about", () => {
    expect(clanFieldOf("bad_name")).toBe("name");
    expect(clanFieldOf("taken")).toBe("name");
    expect(clanFieldOf("bad_motto")).toBe("motto");
    expect(clanFieldOf("bad_crest")).toBe("crest");
    expect(clanFieldOf("bad_world")).toBe("world");
    expect(clanFieldOf("bad_about")).toBe("about");
  });

  it("names none for a refusal about the player, or a sentence from the route", () => {
    for (const code of ["muted", "forbidden", "not_member", "unavailable", "The motto must be one line."]) {
      expect(clanFieldOf(code), code).toBeNull();
    }
  });
});
