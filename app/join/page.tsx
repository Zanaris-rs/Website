import type { Metadata } from "next";
import { redirect } from "next/navigation";

import InviteDoor from "@/components/invite/InviteDoor";
import Frame from "@/components/site/Frame";
import { normalizeInviteCode } from "@/lib/invite/code";
import { DEAD_INVITE_MESSAGE, joinPath } from "@/lib/invite/format";

export const metadata: Metadata = {
  title: "Invite only",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * `/join?code=...` - the paste box on the door. A code that could be one goes
 * to its own page; anything else is answered here without a database call.
 */
export default async function JoinByCode({ searchParams }: PageProps<"/join">) {
  const params = await searchParams;
  const raw = Array.isArray(params.code) ? params.code[0] : params.code;
  const code = typeof raw === "string" ? normalizeInviteCode(raw) : null;

  if (code) redirect(joinPath(code));

  return (
    <Frame>
      <InviteDoor message={raw ? DEAD_INVITE_MESSAGE.not_found : null} />
    </Frame>
  );
}
