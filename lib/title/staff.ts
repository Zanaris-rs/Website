/**
 * Whether the title screen shows its Staff Inbox tile.
 *
 * `load` is what `loadStaff` said about the session cookie, or `null` when
 * there was no cookie to ask about. Only a live, signed-in, staff-level
 * account gets the tile; every other verdict — signed out, a player, the
 * database being away — hides it silently, because the title screen is a
 * public page and a missing tile is not an error. `/staff` itself redirects,
 * and the staff SQL functions re-check the level, so hiding is cosmetic.
 */
export type StaffVerdict = {
  readonly status: "ok" | "signed_out" | "forbidden" | "unavailable";
};

export function showsStaffTile(load: StaffVerdict | null): boolean {
  return load !== null && load.status === "ok";
}
