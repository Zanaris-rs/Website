/**
 * The links in the corner of every staff page.
 *
 * Six pages each grew their own list, and no two of them agreed: the inbox
 * offered Wealth and the reports list offered it under a different name, the
 * notice form offered neither, and no page offered the one you were on any way
 * back to the handbook because there was not one. A moderator's way around
 * the staff side should not depend on which page they happened to land on.
 *
 * So it is one list, in one order, and a page passes its own path to have
 * itself removed from it — a link to the page you are reading is furniture,
 * not navigation.
 *
 * The shape is `TitleBoxLink`'s, structurally, but it is declared here rather
 * than imported: `lib/` does not import from `components/`, and this file is a
 * list of paths, which is not a rendering concern.
 */

export type StaffLink = {
  readonly href: string;
  readonly text: string;
  /** Put this link on its own line instead of after a ` - ` separator. */
  readonly br?: boolean;
};

/** The staff pages, in the order a moderator works through them. */
export const STAFF_PAGES: readonly StaffLink[] = [
  { href: "/staff", text: "Staff inbox" },
  { href: "/staff/reports", text: "Reports" },
  { href: "/staff/notice", text: "Send a notice" },
  { href: "/staff/wealth", text: "Wealth" },
  { href: "/staff/handbook", text: "Handbook" },
];

/**
 * The way out. On its own line because it is not one of the staff pages: the
 * break is what says "and here is the ordinary site again".
 */
export const ACCOUNT_LINK: StaffLink = {
  href: "/account",
  text: "Account Centre",
  br: true,
};

/**
 * The links for one page. `current` is that page's own path, and is left out
 * of the list; a detail page — a ticket, a report — passes nothing and gets
 * all five, because its parent is one of them.
 */
export function staffLinks(current?: string): StaffLink[] {
  return [
    ...STAFF_PAGES.filter((link) => link.href !== current),
    ACCOUNT_LINK,
  ];
}
