import { formatInviteCode } from "./code";

/**
 * How invites are put into words. The citizen number is public and goes on
 * profiles and hiscores; who invited whom never appears here, because the
 * pages that show it are the two players' own and the staff pages.
 */

export type InviteState = "live" | "claimed" | "revoked" | "expired";

/** `#0042`: at least four digits, because the low numbers are the point. */
export function formatCitizen(n: number): string {
  return `#${String(n).padStart(4, "0")}`;
}

export const INVITE_STATE_LABEL: Record<InviteState, string> = {
  live: "Unused",
  claimed: "Used",
  revoked: "Cancelled",
  expired: "Expired",
};

/** The path a link points at, grouped so it can be read aloud. */
export function joinPath(code: string): string {
  return `/join/${formatInviteCode(code)}`;
}

export type DeadInvite =
  | "not_found"
  | "claimed"
  | "revoked"
  | "expired"
  | "rate_limited"
  | "unavailable";

/**
 * What the door says when a link will not open it. None of these names the
 * person who made the link: a used link that was posted somewhere public must
 * not keep telling strangers who handed it out.
 */
export const DEAD_INVITE_MESSAGE: Record<DeadInvite, string> = {
  not_found:
    "That is not a Zanaris invite. Check the link you were sent, or paste the code below.",
  claimed:
    "That invite has already been used. Each link lets exactly one person in — ask for your own.",
  revoked: "That invite has been cancelled. Ask whoever sent it for a new one.",
  expired:
    "That invite has expired. Links last fourteen days — ask whoever sent it for a new one.",
  rate_limited:
    "Too many invite codes have been tried from your connection. Wait a few minutes and try again.",
  unavailable: "Invites cannot be checked right now. Try again shortly.",
};
