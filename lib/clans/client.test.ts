import { describe, expect, it } from "vitest";

import { type ClanAction, CLAN_MESSAGES, clanMessages } from "./client";
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
