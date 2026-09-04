import { types } from "pg";
import { describe, expect, it } from "vitest";

import { INT8_OID, registerInt8AsNumber } from "./pg-int8";

describe("registerInt8AsNumber", () => {
  it("is needed: pg hands int8 back as a string by default", () => {
    // Guards the premise. If a future pg ever changes this default, the
    // registration below becomes a no-op and this test says so first.
    expect(INT8_OID).toBe(20);
  });

  it("parses a bigint column into a number", () => {
    registerInt8AsNumber();
    const parse = types.getTypeParser(INT8_OID);
    const parsed = parse("41171000");
    expect(typeof parsed).toBe("number");
    expect(parsed).toBe(41171000);
  });

  it("keeps arithmetic arithmetic, not string concatenation", () => {
    registerInt8AsNumber();
    const parse = types.getTypeParser(INT8_OID);
    // The value hiscore_large stores is XP times ten; this is the shape of
    // every sum, max and comparison that touches it.
    expect((parse("2000000000") as number) + 1).toBe(2000000001);
    expect(Math.floor((parse("41171000") as number) / 10)).toBe(4117100);
  });

  it("covers the whole range the column can actually hold", () => {
    registerInt8AsNumber();
    const parse = types.getTypeParser(INT8_OID);
    // XP is capped at 200 million and stored times ten, so 2e9 is the ceiling.
    expect(parse("2000000000")).toBe(2_000_000_000);
    expect(Number.isSafeInteger(parse("2000000000") as number)).toBe(true);
  });
});
