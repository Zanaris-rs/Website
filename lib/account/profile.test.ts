import { describe, expect, it } from "vitest";

import {
  GAME_PROFILE,
  RECENT_LOGINS,
  accountStatus,
  formatDay,
  formatWhen,
  parseProfileRow,
  parseRecentLogin,
  presenceLine,
  profileStatement,
  recentLoginsStatement,
} from "./profile";

const NOW = Date.parse("2026-09-05T12:00:00Z");

function row(overrides: Record<string, unknown> = {}) {
  return {
    username: "bob_smith",
    email: "bob@example.com",
    members: false,
    staffmodlevel: 0,
    registration_date: new Date("2026-01-02T03:04:05Z"),
    muted_until: null,
    banned_until: null,
    playable_after: null,
    salt: "$2b$10$abcdefghijklmnopqrstuv",
    logged_in: 0,
    login_time: null,
    logged_out: 0,
    logout_time: null,
    ...overrides,
  };
}

describe("the statements", () => {
  it("read one account's own row, keyed by name and profile", () => {
    expect(profileStatement("bob_smith")).toEqual({
      text: "select * from accounts.profile($1, $2)",
      values: ["bob_smith", GAME_PROFILE],
    });
  });

  it("read the recent logins with a limit the SQL clamps", () => {
    expect(recentLoginsStatement("bob_smith")).toEqual({
      text: "select * from accounts.recent_logins($1, $2, $3)",
      values: ["bob_smith", GAME_PROFILE, RECENT_LOGINS],
    });
  });

  it("never interpolate", () => {
    const nasty = "'; drop table account; --";
    for (const statement of [
      profileStatement(nasty, nasty),
      recentLoginsStatement(nasty, nasty, 99),
    ]) {
      expect(statement.text).not.toContain(nasty);
      expect(statement.values).toContain(nasty);
    }
  });

  it("names the profile the fleet actually runs", () => {
    // engine/src/util/WorldConfig.ts defaults node.profile to 'main' and
    // NODE_PROFILE is unset on the fleet, so every session row carries this.
    expect(GAME_PROFILE).toBe("main");
  });
});

describe("parseProfileRow", () => {
  it("turns a row into the shape the page renders", () => {
    expect(parseProfileRow(row())).toEqual({
      username: "bob_smith",
      email: "bob@example.com",
      members: false,
      staffModLevel: 0,
      registrationDate: "2026-01-02T03:04:05.000Z",
      mutedUntil: null,
      bannedUntil: null,
      playableAfter: null,
      salt: "$2b$10$abcdefghijklmnopqrstuv",
      loggedIn: 0,
      loginTime: null,
      loggedOut: 0,
      logoutTime: null,
    });
  });

  it("is null when there is no row — a cookie for a deleted account", () => {
    expect(parseProfileRow(undefined)).toBeNull();
    expect(parseProfileRow(null)).toBeNull();
    expect(parseProfileRow({})).toBeNull();
    expect(parseProfileRow(row({ username: "" }))).toBeNull();
  });

  it("accepts a timestamp as a string as well as a Date", () => {
    expect(
      parseProfileRow(row({ banned_until: "2026-09-06T00:00:00Z" }))
        ?.bannedUntil,
    ).toBe("2026-09-06T00:00:00.000Z");
  });

  it("turns anything unparseable into null rather than Invalid Date", () => {
    expect(parseProfileRow(row({ banned_until: "not a date" }))?.bannedUntil)
      .toBeNull();
    expect(parseProfileRow(row({ login_time: 12345 }))?.loginTime).toBeNull();
  });
});

describe("parseRecentLogin", () => {
  it("reads the world, the time and the address", () => {
    expect(
      parseRecentLogin({
        world: 1,
        logged_in_at: new Date("2026-09-05T11:00:00Z"),
        ip: "203.0.113.7",
      }),
    ).toEqual({
      world: 1,
      loggedInAt: "2026-09-05T11:00:00.000Z",
      ip: "203.0.113.7",
    });
  });

  it("copes with a null ip, which the column allows", () => {
    expect(
      parseRecentLogin({ world: 2, logged_in_at: null, ip: null }),
    ).toEqual({ world: 2, loggedInAt: null, ip: null });
  });
});

describe("formatWhen and formatDay", () => {
  it("are en-GB and pinned to UTC, not the renderer's locale", () => {
    // Server-rendered: "the reader's locale" would be the server's, and a
    // value that differed between render and hydration is a React mismatch.
    expect(formatWhen("2026-01-02T03:04:05Z")).toBe("2 January 2026, 03:04 UTC");
    expect(formatDay("2026-01-02T03:04:05Z")).toBe("2 January 2026");
  });

  it("say `unknown` rather than Invalid Date", () => {
    for (const bad of [null, undefined, "", "not a date"]) {
      expect(formatWhen(bad)).toBe("unknown");
      expect(formatDay(bad)).toBe("unknown");
    }
  });
});

describe("accountStatus", () => {
  it("says nothing about an account with nothing wrong with it", () => {
    expect(accountStatus(parseProfileRow(row())!, NOW)).toEqual([]);
  });

  it("reports a live ban in red, and says the site still works", () => {
    const [notice, ...rest] = accountStatus(
      parseProfileRow(row({ banned_until: "2026-09-06T12:00:00Z" }))!,
      NOW,
    );
    expect(rest).toEqual([]);
    expect(notice.kind).toBe("banned");
    expect(notice.colour).toBe("red");
    expect(notice.text).toContain("Banned until 6 September 2026, 12:00 UTC");
  });

  it("ignores an expired ban", () => {
    // Showing one has players writing in about a punishment that ended weeks
    // ago; the row keeps the date forever.
    expect(
      accountStatus(
        parseProfileRow(row({ banned_until: "2026-09-05T11:59:59Z" }))!,
        NOW,
      ),
    ).toEqual([]);
  });

  it("reports a mute and a soak in yellow", () => {
    const notices = accountStatus(
      parseProfileRow(
        row({
          muted_until: "2026-09-06T12:00:00Z",
          playable_after: "2026-09-05T13:00:00Z",
        }),
      )!,
      NOW,
    );
    expect(notices.map((n) => n.kind)).toEqual(["muted", "soaking"]);
    expect(notices.every((n) => n.colour === "yellow")).toBe(true);
  });

  it("lists a ban first when several are live at once", () => {
    const notices = accountStatus(
      parseProfileRow(
        row({
          banned_until: "2026-09-06T12:00:00Z",
          muted_until: "2026-09-07T12:00:00Z",
        }),
      )!,
      NOW,
    );
    expect(notices.map((n) => n.kind)).toEqual(["banned", "muted"]);
  });
});

describe("presenceLine", () => {
  it("says which world an online account is on, and since when", () => {
    expect(
      presenceLine(
        parseProfileRow(
          row({ logged_in: 1, login_time: "2026-09-05T11:00:00Z" }),
        )!,
      ),
    ).toBe("Currently online on World 1 since 5 September 2026, 11:00 UTC.");
  });

  it("says when an offline account last logged out, and from where", () => {
    expect(
      presenceLine(
        parseProfileRow(
          row({ logged_out: 2, logout_time: "2026-09-04T22:15:00Z" }),
        )!,
      ),
    ).toBe("Last logged out 4 September 2026, 22:15 UTC (World 2).");
  });

  it("says nothing about an account that has never played", () => {
    expect(presenceLine(parseProfileRow(row())!)).toBeNull();
  });
});
