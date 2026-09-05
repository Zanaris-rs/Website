import type { Metadata } from "next";
import { redirect } from "next/navigation";

import AccountCentre from "@/components/account/AccountCentre";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { loadAccount } from "@/lib/account/profile-server";
import {
  type RecentLogin,
  parseRecentLogin,
  recentLoginsStatement,
} from "@/lib/account/profile";
import { requireSession } from "@/lib/account/session-server";
import { parseUnread, unreadStatement } from "@/lib/messages/queries";
import { query } from "@/lib/db";

export const metadata: Metadata = {
  title: "Account Centre",
  description: "Your Zanaris account: status, recent logins and settings.",
};

/**
 * Reads a cookie and a live account row, so it can never be prerendered and
 * must never be cached — a cached copy is one reader's account served to the
 * next.
 */
export const dynamic = "force-dynamic";

/**
 * The account centre.
 *
 * Two reads, both keyed by the username out of the signed cookie and both
 * through functions the `website` role can only `EXECUTE`: it holds no
 * `SELECT` on `account`, `session` or `account_login`, so there is no way for
 * this page to reach anybody else's row even if it tried.
 *
 * `loadAccount` decides whether the cookie is still good — no row (the account
 * is gone) or a moved salt (the password was changed on another device) both
 * mean signed out. Its verdict is returned rather than redirected, so that
 * every `redirect()` here sits outside a `try`: it works by throwing, and a
 * `catch` would swallow it and render a signed-in page to somebody who is not.
 */
export default async function Account() {
  const session = await requireSession();
  const loaded = await loadAccount(session);

  if (loaded.status === "signed_out") redirect("/account/login");

  if (loaded.status === "unavailable") {
    return (
      <Frame>
        <TitleBox title="Account Centre" />
        <Panel>
          <p>The account centre is unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  // The recent logins are a nicety: if that one read fails, the page is still
  // worth showing without them.
  let logins: RecentLogin[] = [];
  try {
    const recent = recentLoginsStatement(session.u);
    const rows = await query<Record<string, unknown>>(
      recent.text,
      recent.values,
    );
    logins = rows
      .map(parseRecentLogin)
      .filter((login): login is RecentLogin => login !== null);
  } catch (error) {
    console.error("[account] recent logins read failed", error);
  }

  // The same nicety, and the same treatment: `accounts.unread` is the
  // cross-repo contract count — the number the game's welcome screen shows —
  // and it decorates one link. `undefined` when the read fails prints no count
  // rather than a "0" the page cannot stand behind.
  let unread: number | undefined;
  try {
    const wanted = unreadStatement(session.u);
    const rows = await query<{ unread: unknown }>(wanted.text, wanted.values);
    unread = parseUnread(rows[0]?.unread);
  } catch (error) {
    console.error("[account] unread read failed", error);
  }

  return (
    <Frame>
      <AccountCentre
        profile={loaded.profile}
        logins={logins}
        unread={unread}
      />
    </Frame>
  );
}
