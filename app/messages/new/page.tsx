import type { Metadata } from "next";
import { redirect } from "next/navigation";

import NewTicketForm from "@/components/messages/NewTicketForm";
import Frame from "@/components/site/Frame";
import { loadAccount } from "@/lib/account/profile-server";
import { requireSession } from "@/lib/account/session-server";

export const metadata: Metadata = {
  title: "New ticket",
  description: "Report a bug or appeal a ban through the Zanaris Message Centre.",
};

export const dynamic = "force-dynamic";

/**
 * The ticket form.
 *
 * `/messages/new` and `/messages/[id]` are siblings, and Next matches the
 * literal segment first, so there is no id `new` that could shadow this page.
 *
 * The account is loaded only to decide whether the cookie is still good — the
 * form itself needs nothing from the profile, and the ticket is opened by a
 * route that reads the username out of the cookie again. A banned account
 * reaches this page on purpose: appealing is what it is for.
 */
export default async function NewTicket() {
  const session = await requireSession();
  const loaded = await loadAccount(session);

  if (loaded.status === "signed_out") redirect("/account/login");

  return (
    <Frame>
      <NewTicketForm />
    </Frame>
  );
}
