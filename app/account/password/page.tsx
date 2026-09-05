import type { Metadata } from "next";

import ChangePasswordForm from "@/components/account/ChangePasswordForm";
import Frame from "@/components/site/Frame";
import { requireSession } from "@/lib/account/session-server";

export const metadata: Metadata = {
  title: "Change password",
  description: "Change the password on your Zanaris account.",
};

export const dynamic = "force-dynamic";

/**
 * Only a session is needed to *show* this form. Whether the typed password is
 * right is decided by `accounts.change_password`, in the database, on the
 * POST — this page never reads the account row, so there is nothing here to
 * leak and nothing to keep in sync.
 */
export default async function ChangePassword() {
  await requireSession();

  return (
    <Frame>
      <ChangePasswordForm />
    </Frame>
  );
}
