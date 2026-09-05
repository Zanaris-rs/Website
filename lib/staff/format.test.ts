import { describe, expect, it } from "vitest";

import { formatWhen } from "@/lib/messages/format";
import { ORIGINAL_RULES } from "@/lib/rules/original";

import {
  FIRST_REPORT_REASON,
  LAST_REPORT_REASON,
  chatKindLabel,
  coordLabel,
  punishmentUntilLabel,
  reportReasonLabel,
  reporterLabel,
  resolutionLabel,
  unpackCoord,
  wealthEventLabel,
  worldLabel,
} from "./format";

/**
 * Two foreign encodings, transcribed from the engine. Both are the sort of
 * thing that is silently off by one for a year: a report against rule 7 shown
 * as rule 6 reads perfectly and is wrong, and a coordinate whose level is
 * decoded from the wrong bits points at a place the offender has never been.
 */

describe("reportReasonLabel", () => {
  it("is one-based on the client's zero-based enum", () => {
    // ReportAbuseReason: OFFENSIVE_LANGUAGE = 0, and rule 1 is Offensive
    // Language. The whole risk in this file is this single +1.
    expect(reportReasonLabel(0)).toBe("1. Offensive Language");
    expect(reportReasonLabel(1)).toBe("2. Item Scamming");
    expect(reportReasonLabel(11)).toBe("12. Real World Item Trading");
  });

  it("covers every value the handler will forward and no more", () => {
    // ReportAbuseHandler refuses anything outside
    // OFFENSIVE_LANGUAGE..REAL_WORLD_TRADING before the packet is forwarded,
    // so exactly these twelve can ever reach the table.
    expect(LAST_REPORT_REASON - FIRST_REPORT_REASON + 1).toBe(
      ORIGINAL_RULES.length,
    );
    for (let reason = FIRST_REPORT_REASON; reason <= LAST_REPORT_REASON; reason++) {
      expect(reportReasonLabel(reason)).not.toBe("unknown");
      expect(reportReasonLabel(reason)).toMatch(/^\d+\. \S/);
    }
  });

  it("shows the number rather than a wrong rule when the enum has grown", () => {
    expect(reportReasonLabel(12)).toBe("Rule 13");
  });

  it("says unknown for a row with no reason", () => {
    expect(reportReasonLabel(null)).toBe("unknown");
    expect(reportReasonLabel(1.5)).toBe("unknown");
  });
});

describe("unpackCoord", () => {
  it("inverts CoordGrid.packCoord", () => {
    const pack = (level: number, x: number, z: number) =>
      (z & 0x3fff) | ((x & 0x3fff) << 14) | ((level & 0x3) << 28);

    for (const [level, x, z] of [
      [0, 3222, 3218],
      [1, 3200, 3200],
      [3, 16383, 16383],
      [0, 0, 0],
    ] as const) {
      expect(unpackCoord(pack(level, x, z))).toEqual({ level, x, z });
    }
  });

  it("uses an unsigned shift, so level 3 is not a negative number", () => {
    // (3 << 28) is 805306368, which fits; (3 << 28) | (16383 << 14) sets bit
    // 31 and a signed `>>` would make the whole value negative.
    const packed = (3 << 28) | (16383 << 14) | 16383;
    expect(unpackCoord(packed >>> 0)?.level).toBe(3);
  });

  it("is null for a value that is not a packed coordinate", () => {
    expect(unpackCoord(-1)).toBeNull();
    expect(unpackCoord(1.5)).toBeNull();
  });
});

describe("coordLabel", () => {
  it("names the level only when there is one", () => {
    const pack = (level: number, x: number, z: number) =>
      (z & 0x3fff) | ((x & 0x3fff) << 14) | ((level & 0x3) << 28);
    expect(coordLabel(pack(0, 3222, 3218))).toBe("3222, 3218");
    expect(coordLabel(pack(1, 3222, 3218))).toBe("3222, 3218 (level 1)");
  });

  it("says unknown for a row with no coordinate", () => {
    expect(coordLabel(null)).toBe("unknown");
  });
});

describe("the two nullable columns", () => {
  it("say unknown rather than 'World null'", () => {
    expect(worldLabel(1)).toBe("World 1");
    expect(worldLabel(null)).toBe("unknown");
    expect(reporterLabel("bob_smith")).toBe("bob_smith");
    expect(reporterLabel("")).toBe("unknown");
  });
});

describe("wealthEventLabel", () => {
  it("is zero-based on the engine's WealthEventType", () => {
    // TRADE = 0 and PARTY_ROOM = 10. An off-by-one here would show a trade as
    // a player kill on a page somebody bans an account from.
    expect(wealthEventLabel(0)).toBe("Trade");
    expect(wealthEventLabel(1)).toBe("Player kill");
    expect(wealthEventLabel(10)).toBe("Party room");
  });

  it("shows a number it does not know as itself, never as a wrong label", () => {
    expect(wealthEventLabel(11)).toBe("Event 11");
    expect(wealthEventLabel(-1)).toBe("Event -1");
    expect(wealthEventLabel(null)).toBe("unknown");
    expect(wealthEventLabel(1.5)).toBe("unknown");
  });
});

describe("resolutionLabel", () => {
  it("calls a report with no resolution open", () => {
    expect(resolutionLabel(null)).toBe("Open");
    expect(resolutionLabel("")).toBe("Open");
  });

  it("names the three the function accepts", () => {
    expect(resolutionLabel("actioned")).toBe("Actioned");
    expect(resolutionLabel("dismissed")).toBe("Dismissed");
    expect(resolutionLabel("watch")).toBe("Watching");
  });

  it("passes a resolution it does not know through", () => {
    expect(resolutionLabel("escalated")).toBe("escalated");
  });
});

describe("the evidence vocabulary", () => {
  it("separates a public line from a private one", () => {
    expect(chatKindLabel("public")).toBe("Public");
    expect(chatKindLabel("private_sent")).toBe("Private");
  });

  it("says permanent, which is not the same as unknown", () => {
    // A ban with no end date is the one case where a missing value is the most
    // important thing on the row, and "until null" would read as a bug.
    expect(punishmentUntilLabel(null)).toBe("permanent");
  });

  it("dates a ban with the same formatter every other staff date uses", () => {
    expect(punishmentUntilLabel("2026-09-12T12:00:00.000Z")).toBe(
      `until ${formatWhen("2026-09-12T12:00:00.000Z")}`,
    );
    expect(punishmentUntilLabel("2026-09-12T12:00:00.000Z")).toContain(
      "12 September 2026",
    );
  });
});
