import type { Metadata } from "next";
import { redirect } from "next/navigation";

import StaffHandbook from "@/components/staff/StaffHandbook";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { requireSession } from "@/lib/account/session-server";
import type { Handbook } from "@/lib/staff/handbook";
import { readHandbook } from "@/lib/staff/handbook-server";
import { loadStaff } from "@/lib/staff/staff-server";

export const metadata: Metadata = {
  title: "Moderation handbook",
  description: "How Zanaris moderators use the tools they have.",
};

export const dynamic = "force-dynamic";

/**
 * The handbook, behind exactly the gate every other staff page is behind: the
 * level is read from the database on this request, a non-staff account is
 * redirected to the login form rather than shown a 403, and a database that
 * cannot be read gets a panel.
 *
 * The gate is not a formality here even though nothing on the page is secret
 * in the way a ticket is. The handbook is a description of what moderators
 * watch for and where each signal is weak, which is a document written for the
 * people enforcing the rules and not for the people looking for the edges of
 * them.
 *
 * The files are read *inside* a `try`, unlike the news pages, because they are
 * read on the request rather than at build time: a section with a typo in its
 * frontmatter must become the "unavailable" panel rather than a stack trace on
 * a moderator's screen. `npm test` is what catches that typo before it ships.
 */
export default async function Handbook() {
  const session = await requireSession();
  const staff = await loadStaff(session);

  if (staff.status === "signed_out" || staff.status === "forbidden") {
    redirect("/account/login");
  }

  const unavailable = (
    <Frame>
      <TitleBox title="Moderation handbook" />
      <Panel>
        <p>The handbook is unavailable right now. Try again shortly.</p>
      </Panel>
    </Frame>
  );

  if (staff.status === "unavailable") {
    return unavailable;
  }

  let handbook: Handbook;
  try {
    handbook = readHandbook();
  } catch (error) {
    console.error("[staff] handbook read failed", error);
    return unavailable;
  }

  return (
    <Frame>
      <StaffHandbook handbook={handbook} />
    </Frame>
  );
}
