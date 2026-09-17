import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import RegisterForm from "@/components/account/RegisterForm";
import InviteDoor from "@/components/invite/InviteDoor";
import Frame from "@/components/site/Frame";
import { clientIp } from "@/lib/account/ip";
import { isConfigured, query } from "@/lib/db";
import { formatInviteCode, normalizeInviteCode } from "@/lib/invite/code";
import { DEAD_INVITE_MESSAGE, type DeadInvite, joinPath } from "@/lib/invite/format";
import { isTopLevelNavigation } from "@/lib/invite/fetch-guard";
import { invitePreviewStatement, parseInvitePreview } from "@/lib/invite/queries";

export const metadata: Metadata = {
  // Static and neutral: this title also shows on a dead link (used, revoked,
  // expired), where "You're invited" would be actively wrong.
  title: "Zanaris invite",
  description: "Claim your place on Zanaris.",
  robots: { index: false, follow: false },
};

/** Reads the database on every request; a cached copy would outlive the link. */
export const dynamic = "force-dynamic";

/**
 * One invite link.
 *
 * The code is normalised first - a link retyped in lower case, or with the
 * dashes lost, still works - and a non-canonical spelling is redirected to the
 * canonical one so there is one URL per invite. A string that cannot be a code
 * is answered without touching the database.
 *
 * Previewing does not claim anything: the link is only spent when the form
 * below creates an account, inside `accounts.register_with_invite`.
 *
 * Previewing does touch the database, though: a well-formed but unknown code
 * writes an `invite_attempt` row for the visitor's IP, and thirty of those in
 * fifteen minutes locks the address out (see `accounts.invite_preview`). A
 * real invite click - even one opened inside Discord's in-app browser - is a
 * top-level navigation, so `isTopLevelNavigation` (`lib/invite/fetch-guard.ts`)
 * gates the preview on it: an `<img>`, `<iframe>` or `<script>` fetching this
 * same URL from somebody else's page is not a person arriving, and gets the
 * generic invite-only door with no database call at all.
 */
export default async function Join({ params }: PageProps<"/join/[code]">) {
  const { code: segment } = await params;

  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {}

  const code = normalizeInviteCode(decoded);
  if (!code) return <Dead reason="not_found" />;
  if (decoded !== formatInviteCode(code)) redirect(joinPath(code));

  if (!isConfigured()) return <Dead reason="unavailable" />;

  const requestHeaders = await headers();
  if (!isTopLevelNavigation(requestHeaders)) {
    return (
      <Frame>
        <InviteDoor />
      </Frame>
    );
  }

  let dead: DeadInvite | null = null;
  let inviter = "";
  try {
    const ip = clientIp(requestHeaders) ?? "";
    const statement = invitePreviewStatement(code, ip);
    const rows = await query<Record<string, unknown>>(statement.text, statement.values);
    const preview = parseInvitePreview(rows[0]);
    if (preview.result === "ok") {
      inviter = preview.inviter ?? "";
    } else {
      dead = preview.result;
    }
  } catch (error) {
    console.error("[join] preview failed", error);
    dead = "unavailable";
  }

  if (dead) return <Dead reason={dead} />;

  return (
    <Frame>
      <RegisterForm invite={{ code, inviter }} />
    </Frame>
  );
}

function Dead({ reason }: { reason: DeadInvite }) {
  return (
    <Frame>
      <InviteDoor message={DEAD_INVITE_MESSAGE[reason]} />
    </Frame>
  );
}
