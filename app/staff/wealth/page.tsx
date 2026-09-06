import type { Metadata } from "next";
import { redirect } from "next/navigation";

import StaffWealth from "@/components/staff/StaffWealth";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { requireSession } from "@/lib/account/session-server";
import { canonicalizeUsername } from "@/lib/account/validation";
import {
  type WealthRow,
  parseSince,
  parseWealthRow,
  staffWealthStatement,
} from "@/lib/staff/queries";
import { loadStaff } from "@/lib/staff/staff-server";
import { query } from "@/lib/db";

export const metadata: Metadata = {
  title: "Wealth",
  description: "A player's recent wealth events, for Zanaris staff.",
};

export const dynamic = "force-dynamic";

/**
 * `/staff/wealth?username=bob_smith` — one player's trades, stakes, deaths,
 * drops and pickups over the last seven days.
 *
 * The name is canonicalised the way the login form does it, not the way
 * registration does: `mod_*` and `admin` are reserved *for registration* and
 * are exactly the accounts a moderator might need to look at.
 *
 * A name that cannot be encoded is a message, not an empty table — an empty
 * table for a typo reads as "this player has done nothing", which is the one
 * conclusion this page must never draw by accident.
 */
export default async function StaffWealthPage({
  searchParams,
}: PageProps<"/staff/wealth">) {
  const session = await requireSession();
  const staff = await loadStaff(session);

  if (staff.status === "signed_out" || staff.status === "forbidden") {
    redirect("/account/login");
  }

  if (staff.status === "unavailable") {
    return (
      <Frame>
        <TitleBox title="Wealth" />
        <Panel>
          <p>The staff tools are unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  const params = await searchParams;
  const raw = Array.isArray(params.username)
    ? params.username[0]
    : params.username;
  const since = parseSince(
    Array.isArray(params.since) ? params.since[0] : params.since,
  );

  let username = "";
  let error: string | null = null;
  let rows: WealthRow[] = [];

  if (typeof raw === "string" && raw.trim() !== "") {
    const wanted = canonicalizeUsername(raw);
    if (!wanted.ok) {
      error =
        wanted.error === "username_unencodable"
          ? "That is not a name the game can address."
          : "A username is 1 to 12 letters, digits, spaces or underscores.";
    } else {
      username = wanted.value;
      try {
        // The actor is the signed-in moderator and the name searched for is
        // the second argument; the two are only ever the same string when a
        // moderator looks themselves up.
        const wantedRows = staffWealthStatement(
          staff.profile.username,
          username,
          since,
        );
        const answered = await query<Record<string, unknown>>(
          wantedRows.text,
          wantedRows.values,
        );
        rows = answered
          .map(parseWealthRow)
          .filter((row): row is WealthRow => row !== null);
      } catch (readError) {
        console.error("[staff] wealth read failed", readError);
        error = "The wealth log is unavailable right now. Try again shortly.";
      }
    }
  }

  return (
    <Frame>
      <StaffWealth username={username} rows={rows} error={error} />
    </Frame>
  );
}
