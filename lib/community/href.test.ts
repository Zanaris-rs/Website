import { describe, expect, it } from "vitest";

import { COMMUNITY_HREF, communityLinks, type CommunitySection, yourLogLinks } from "./href";

describe("COMMUNITY_HREF", () => {
  it("is the hub's address", () => {
    expect(COMMUNITY_HREF).toBe("/community");
  });
});

describe("communityLinks", () => {
  it("is the one bar, in the spec's order, with nothing current on a player's log", () => {
    expect(communityLinks(null)).toEqual([
      { href: "/community", text: "Community", current: false },
      { href: "/hiscores", text: "Hiscores", current: false },
      { href: "/hiscores/records", text: "Records", current: false },
      { href: "/adventurers", text: "Adventurer Logs", current: false },
      { href: "/clans", text: "Clans", current: false },
    ]);
  });

  it("marks the page you are on, and only that one", () => {
    const sections: [CommunitySection, string][] = [
      ["community", "Community"],
      ["hiscores", "Hiscores"],
      ["records", "Records"],
      ["logs", "Adventurer Logs"],
      ["clans", "Clans"],
    ];
    for (const [section, text] of sections) {
      const current = communityLinks(section).filter((link) => link.current);
      expect(current.map((link) => link.text), section).toEqual([text]);
    }
  });

  it("hands out a fresh list each time", () => {
    expect(communityLinks("logs")).not.toBe(communityLinks("logs"));
  });
});

describe("yourLogLinks", () => {
  it("is View, Character, Clan, Records and Log settings", () => {
    expect(yourLogLinks("zezima", false)).toEqual([
      { href: "/adventurer/zezima", text: "View" },
      { href: "/account/adventurer-log/character", text: "Character" },
      { href: "/account/adventurer-log/clan", text: "Clan" },
      { href: "/account/records", text: "Records" },
      { href: "/account/adventurer-log", text: "Log settings" },
    ]);
  });

  it("leaves View out on your own log", () => {
    expect(yourLogLinks("zezima", true).map((link) => link.text)).toEqual([
      "Character",
      "Clan",
      "Records",
      "Log settings",
    ]);
  });

  it("links your log by its stored name", () => {
    expect(yourLogLinks("lynx_titan", false)[0].href).toBe("/adventurer/lynx_titan");
  });
});
