import { describe, expect, it } from "vitest";

import type { InviteRow } from "./queries";
import { inviteView } from "./view";

const when = (iso: string | null) => (iso ? `at ${iso.slice(0, 10)}` : "-");

const row: InviteRow = {
  code: "VTPVXVR14D2PF2DB",
  createdAt: "2026-09-16T00:00:00.000Z",
  expiresAt: "2026-09-30T00:00:00.000Z",
  state: "live",
  claimedBy: null,
  claimedAt: null,
};

describe("inviteView", () => {
  it("gives a live link its path and a way to cancel it", () => {
    expect(inviteView(row, when)).toEqual({
      code: "VTPVXVR14D2PF2DB",
      display: "VTPV-XVR1-4D2P-F2DB",
      path: "/join/VTPV-XVR1-4D2P-F2DB",
      state: "live",
      label: "Unused",
      created: "at 2026-09-16",
      detail: "Works until at 2026-09-30",
      shareable: true,
    });
  });

  it("names who used a claimed link, and offers nothing to share", () => {
    const view = inviteView(
      { ...row, state: "claimed", claimedBy: "bob_smith", claimedAt: "2026-09-17T00:00:00.000Z" },
      when,
    );
    expect(view.label).toBe("Used");
    expect(view.detail).toBe("Bob Smith joined at 2026-09-17");
    expect(view.shareable).toBe(false);
  });

  it("says a dead link is dead", () => {
    expect(inviteView({ ...row, state: "expired" }, when).detail).toBe("Expired at 2026-09-30");
    expect(inviteView({ ...row, state: "revoked" }, when).detail).toBe("No longer works");
    expect(inviteView({ ...row, state: "revoked" }, when).shareable).toBe(false);
  });
});
