import "server-only";

import { loadAccount } from "@/lib/account/profile-server";
import type { Profile } from "@/lib/account/profile";
import type { Session } from "@/lib/account/session";

/**
 * "Is the account behind this cookie staff, right now?"
 *
 * The session cookie carries a username, an issue time and a fingerprint of
 * the password salt — and deliberately **no staff level**. A level in the
 * cookie would be a level that survives a demotion for seven days, and one
 * that anybody who could forge a cookie could grant themselves. So every staff
 * page and every staff route asks the database again, on every request,
 * through `accounts.profile`.
 *
 * That is the second of two locks, not the only one: the SQL functions behind
 * the staff pages call `accounts.is_staff(p_actor)` themselves — a `WHERE`
 * clause in the reads, an early `RETURN 'forbidden'` in the writes — so a route
 * that forgot this check would still return nothing and write nothing. This
 * check decides what somebody *sees*; the SQL decides what they can *do*.
 *
 * Like `loadAccount`, it returns a verdict rather than redirecting: a helper
 * that called `redirect()` would have to live outside its caller's `try`
 * (redirect works by throwing), and every caller would eventually get that
 * wrong.
 */

/**
 * Level 2 and above. The engine's own ladder is 0 player, 1 helper, 2
 * moderator, 3 admin; the hiscores views already hide `staffmodlevel > 1`,
 * which is the same line drawn from the other side.
 */
export const STAFF_MOD_LEVEL = 2;

export type StaffLoad =
  | { readonly status: "ok"; readonly profile: Profile }
  /** The cookie is no longer good for anything. */
  | { readonly status: "signed_out" }
  /** A real, signed-in account that is not staff. */
  | { readonly status: "forbidden" }
  /** No database, or the read failed. */
  | { readonly status: "unavailable" };

export function isStaff(profile: Profile): boolean {
  return profile.staffModLevel >= STAFF_MOD_LEVEL;
}

export async function loadStaff(session: Session): Promise<StaffLoad> {
  const loaded = await loadAccount(session);
  if (loaded.status !== "ok") return loaded;
  if (!isStaff(loaded.profile)) return { status: "forbidden" };
  return loaded;
}
