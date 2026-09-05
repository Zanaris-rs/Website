import type { Metadata } from "next";
import { redirect } from "next/navigation";

import StaffNoticeForm from "@/components/staff/StaffNoticeForm";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { requireSession } from "@/lib/account/session-server";
import { loadStaff } from "@/lib/staff/staff-server";

export const metadata: Metadata = {
  title: "Send a notice",
  description: "Write a notice into a player's Zanaris Message Centre.",
};

export const dynamic = "force-dynamic";

/**
 * The notice form.
 *
 * The staff level is read from the database here so that a player never sees
 * the form at all, and read *again* inside `accounts.staff_notice`, which also
 * compares the re-typed password against the actor's own stored hash. The page
 * check decides what is shown; the two checks in the SQL decide what happens.
 *
 * A signed-in non-staff account is redirected to the login form rather than
 * shown a 403, exactly as at `/staff`.
 *
 * A database that cannot be read gets a panel rather than the form. Nothing
 * would be *lost* by rendering it — the route would refuse the post — but the
 * one thing this page must not do is show a moderator's form to somebody whose
 * level could not be checked.
 */
export default async function StaffNotice() {
  const session = await requireSession();
  const staff = await loadStaff(session);

  if (staff.status === "signed_out" || staff.status === "forbidden") {
    redirect("/account/login");
  }

  if (staff.status === "unavailable") {
    return (
      <Frame>
        <TitleBox title="Send a notice" />
        <Panel>
          <p>The staff inbox is unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  return (
    <Frame>
      <StaffNoticeForm />
    </Frame>
  );
}
