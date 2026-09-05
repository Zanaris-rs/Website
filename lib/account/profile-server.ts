import "server-only";

import { isConfigured, query } from "@/lib/db";

import { type Profile, parseProfileRow, profileStatement } from "./profile";
import { sessionVersion } from "./salt";
import type { Session } from "./session";

/**
 * "Read the signed-in account, and decide whether the cookie is still good."
 *
 * Two pages need exactly this — the account centre and the change-email form —
 * and the decision it encodes is the one place a stateless session gets
 * revoked, so it is worth having once rather than twice:
 *
 * - **no row** means the account was deleted or renamed under a cookie that is
 *   still cryptographically valid;
 * - **a different salt fingerprint** means the password was changed somewhere
 *   else, and this cookie is the one that should now stop working.
 *
 * It returns a verdict instead of redirecting, because `redirect()` works by
 * throwing: a helper that redirected would have to be called outside the
 * caller's `try`, and every caller would get that wrong eventually. Here the
 * database call is wrapped and the redirect is the caller's own statement.
 */
export type AccountLoad =
  | { readonly status: "ok"; readonly profile: Profile }
  /** The cookie is no longer good for anything: send them to the login form. */
  | { readonly status: "signed_out" }
  /** No database, or the read failed: show the "unavailable" panel. */
  | { readonly status: "unavailable" };

export async function loadAccount(session: Session): Promise<AccountLoad> {
  if (!isConfigured()) return { status: "unavailable" };

  let profile: Profile | null;
  try {
    const wanted = profileStatement(session.u);
    const rows = await query<Record<string, unknown>>(
      wanted.text,
      wanted.values,
    );
    profile = parseProfileRow(rows[0]);
  } catch (error) {
    console.error("[account] profile read failed", error);
    return { status: "unavailable" };
  }

  if (!profile) return { status: "signed_out" };
  if (sessionVersion(profile.salt) !== session.sv) {
    return { status: "signed_out" };
  }

  return { status: "ok", profile };
}
