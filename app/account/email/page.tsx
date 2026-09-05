import type { Metadata } from "next";
import { redirect } from "next/navigation";

import ChangeEmailForm from "@/components/account/ChangeEmailForm";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { loadAccount } from "@/lib/account/profile-server";
import { requireSession } from "@/lib/account/session-server";

export const metadata: Metadata = {
  title: "Change email",
  description: "Change the contact email on your Zanaris account.",
};

export const dynamic = "force-dynamic";

/**
 * Unlike the password form, this one reads the account row: the page shows the
 * address currently on file, so that "change it" is a decision somebody can
 * make rather than a blank box.
 */
export default async function ChangeEmail() {
  const session = await requireSession();
  const loaded = await loadAccount(session);

  // Outside any try: `redirect()` works by throwing.
  if (loaded.status === "signed_out") redirect("/account/login");

  if (loaded.status === "unavailable") {
    return (
      <Frame>
        <TitleBox title="Change email" />
        <Panel>
          <p>The account centre is unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  return (
    <Frame>
      <ChangeEmailForm current={loaded.profile.email} />
    </Frame>
  );
}
