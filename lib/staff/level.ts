import type { Profile } from "@/lib/account/profile";

/**
 * Where the staff line is drawn, on its own so that anything can ask.
 *
 * `lib/staff/staff-server.ts` is `server-only` and pulls in the database pool;
 * the account centre only wants to know whether to print one extra link, and
 * should not have to import a pool to find out. Both read the same constant,
 * which is the point of it having a name.
 *
 * Level 2 and above. The engine's ladder is 0 player, 1 helper, 2 moderator,
 * 3 admin; the hiscores views already hide `staffmodlevel > 1`, which is the
 * same line drawn from the other side.
 */
export const STAFF_MOD_LEVEL = 2;

export function isStaff(profile: Pick<Profile, "staffModLevel">): boolean {
  return profile.staffModLevel >= STAFF_MOD_LEVEL;
}
