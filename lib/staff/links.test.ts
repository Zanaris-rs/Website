import { describe, expect, it } from "vitest";

import { ACCOUNT_LINK, STAFF_PAGES, staffLinks } from "./links";

describe("staffLinks", () => {
  it("offers every staff page, then the way out", () => {
    expect(staffLinks().map((link) => link.href)).toEqual([
      "/staff",
      "/staff/reports",
      "/staff/notice",
      "/staff/wealth",
      "/staff/invites",
      "/staff/invites/genealogy",
      "/staff/handbook",
      "/account",
    ]);
  });

  it.each(STAFF_PAGES.map((page) => page.href))(
    "leaves %s out of its own list",
    (href) => {
      expect(staffLinks(href).map((link) => link.href)).not.toContain(href);
    },
  );

  it("drops exactly one link, and keeps the rest in order", () => {
    const links = staffLinks("/staff/notice");
    expect(links).toHaveLength(STAFF_PAGES.length);
    expect(links.map((link) => link.text)).toEqual([
      "Staff inbox",
      "Reports",
      "Wealth",
      "Invites",
      "Genealogy",
      "Handbook",
      "Account Centre",
    ]);
  });

  it("gives a detail page the whole list, since its parent is on it", () => {
    // `/staff/tickets/12` and `/staff/reports/34` are not staff pages in their
    // own right, so nothing is removed and the way back is still there.
    expect(staffLinks("/staff/reports/34")).toEqual(staffLinks());
  });

  it("puts the account link on its own line and nothing else", () => {
    const links = staffLinks();
    expect(links.filter((link) => link.br === true)).toEqual([ACCOUNT_LINK]);
  });

  it("hands back a fresh array each time", () => {
    const links = staffLinks();
    links.pop();
    expect(staffLinks()).toHaveLength(STAFF_PAGES.length + 1);
  });
});
