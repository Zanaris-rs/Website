import { describe, expect, it } from "vitest";

import { MAX_ROW_ID, parseId } from "@/lib/messages/queries";

import { reportStatement, reportTargetId } from "./queries";
import { parseStaffReports } from "./staff";

const CLAN_REPORT = {
  id: 9,
  target_kind: "clan",
  target_id: 7,
  log_owner: "Varrock Knights",
  author: "zezima",
  reporter: "staffy",
  reason: "rude motto",
  created_at: "2026-09-27T10:00:00Z",
  content: "For the King!\nWe guard Varrock.",
  css: null,
  content_state: "shown",
  resolved_at: null,
  resolution: null,
  resolved_by: null,
  note: null,
};

describe("clan reports", () => {
  it("are sent with the clan's id, and no log name", () => {
    expect(reportStatement("staffy", "clan", 7, null, "rude motto")).toEqual({
      text: "select accounts.adventure_report($1, $2, $3, $4, $5) as result",
      values: ["staffy", "clan", 7, null, "rude motto"],
    });
  });

  it("read as the clan's name, its Leader, and its motto and About", () => {
    expect(parseStaffReports([CLAN_REPORT])).toEqual([
      {
        id: 9,
        targetKind: "clan",
        targetId: 7,
        logOwner: "Varrock Knights",
        author: "zezima",
        reporter: "staffy",
        reason: "rude motto",
        createdAt: "2026-09-27T10:00:00.000Z",
        content: "For the King!\nWe guard Varrock.",
        css: null,
        contentState: "shown",
        resolvedAt: null,
        resolution: null,
        resolvedBy: null,
        note: null,
      },
    ]);
  });

  it("read a clan that is gone", () => {
    const [gone] = parseStaffReports([
      { ...CLAN_REPORT, log_owner: null, author: null, content: null, content_state: "deleted" },
    ]);
    expect(gone).toMatchObject({ targetKind: "clan", logOwner: null, contentState: "deleted" });
  });

  it("still throw on a kind nobody documented", () => {
    expect(() => parseStaffReports([{ ...CLAN_REPORT, target_kind: "guild" }])).toThrow(/guild/);
  });
});

describe("a report's target id", () => {
  it("is a row id: a whole number from 1 to the top of int4", () => {
    expect(reportTargetId(1)).toBe(1);
    expect(reportTargetId(2147483647)).toBe(2147483647);
  });

  it("is nothing for anything else, so the route answers not_found rather than 503", () => {
    for (const bad of [0, -1, 1.5, 2147483648, 1e21, Number.NaN, Number.POSITIVE_INFINITY, "7", null, undefined, {}]) {
      expect(reportTargetId(bad), String(bad)).toBeNull();
    }
  });

  it("agrees with parseId, which the gz and clan routes use", () => {
    for (const id of [1, 42, MAX_ROW_ID - 1, MAX_ROW_ID, MAX_ROW_ID + 1, 0, -3, 2.5]) {
      expect(reportTargetId(id), String(id)).toBe(parseId(String(id)));
    }
  });
});
