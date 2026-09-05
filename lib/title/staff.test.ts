import { describe, expect, it } from "vitest";

import { showsStaffTile } from "./staff";

describe("showsStaffTile", () => {
  it("shows the tile only for a live staff session", () => {
    expect(showsStaffTile({ status: "ok" })).toBe(true);
  });

  it("hides it when there was no cookie to check", () => {
    expect(showsStaffTile(null)).toBe(false);
  });

  it.each(["signed_out", "forbidden", "unavailable"] as const)(
    "hides it on a %s verdict rather than erroring",
    (status) => {
      expect(showsStaffTile({ status })).toBe(false);
    },
  );
});
