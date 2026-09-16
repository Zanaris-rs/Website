import type { Metadata } from "next";

import InviteDoor from "@/components/invite/InviteDoor";
import Frame from "@/components/site/Frame";

export const metadata: Metadata = {
  title: "Invite only",
  description: "Zanaris accounts are by invitation from existing players.",
};

/**
 * Registration is by invite since migration 6: the form lives at
 * `/join/<code>`, and this page is the door everybody else reaches.
 */
export default function Register() {
  return (
    <Frame>
      <InviteDoor />
    </Frame>
  );
}
