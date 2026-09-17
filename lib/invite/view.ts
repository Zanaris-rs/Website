import { toDisplayName } from "@/lib/base37";

import { formatInviteCode } from "./code";
import { INVITE_STATE_LABEL, type InviteState, joinPath } from "./format";
import type { InviteRow } from "./queries";

/**
 * One link as the invite page shows it. Dates are formatted on the server and
 * handed to the client component as strings, so nothing is formatted twice in
 * two time zones.
 */
export type InviteView = {
  readonly code: string;
  readonly display: string;
  readonly path: string;
  readonly state: InviteState;
  readonly label: string;
  readonly created: string;
  readonly detail: string;
  /** Only an unused link is worth copying or cancelling. */
  readonly shareable: boolean;
};

export function inviteView(
  row: InviteRow,
  when: (iso: string | null) => string,
): InviteView {
  let detail: string;
  switch (row.state) {
    case "live":
      detail = `Works until ${when(row.expiresAt)}`;
      break;
    case "claimed":
      detail = `${row.claimedBy ? toDisplayName(row.claimedBy) : "Somebody"} joined ${when(row.claimedAt)}`;
      break;
    case "expired":
      detail = `Expired ${when(row.expiresAt)}`;
      break;
    case "revoked":
      detail = "No longer works";
      break;
  }

  return {
    code: row.code,
    display: formatInviteCode(row.code),
    path: joinPath(row.code),
    state: row.state,
    label: INVITE_STATE_LABEL[row.state],
    created: when(row.createdAt),
    detail,
    shareable: row.state === "live",
  };
}
