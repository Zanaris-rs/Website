import { describe, expect, it } from "vitest";

import {
  defaultLooksStatement,
  gameLooksStatement,
  outfitDeleteStatement,
  outfitImportStatement,
  outfitSaveStatement,
  outfitSetDefaultStatement,
  outfitStatusFor,
  outfitsStatement,
  parseDefaultLooks,
  parseGameLooks,
  parseOutfitImport,
  parseOutfitWrite,
  parseOutfits,
} from "./queries";

// A name that would break anything that interpolated it.
const HOSTILE = "x'); drop table account; --";

const LOOK = {
  gender: 0,
  kits: [0, 10, 18, 26, 33, 36, 42],
  colours: [1, 2, 3, 4, 5],
  worn: [1163, -1, -1, -1, 1127, -1, -1, -1, -1, -1, -1, -1, -1, -1],
};

const row = (extra: Record<string, unknown>) => ({
  gender: LOOK.gender,
  kits: LOOK.kits,
  colours: LOOK.colours,
  worn: LOOK.worn,
  ...extra,
});

describe("statements", () => {
  it("pass the name and everything else as values, never in the text", () => {
    for (const statement of [
      outfitsStatement(HOSTILE),
      outfitSaveStatement(HOSTILE, 3, { name: HOSTILE, look: LOOK }),
      outfitDeleteStatement(HOSTILE, 3),
      outfitSetDefaultStatement(HOSTILE, 3),
      outfitImportStatement(HOSTILE),
      defaultLooksStatement([HOSTILE]),
      gameLooksStatement([HOSTILE]),
    ]) {
      expect(statement.text).not.toContain("drop");
      expect(JSON.stringify(statement.values)).toContain("drop table");
    }
  });

  it("send the look as three int arrays", () => {
    const statement = outfitSaveStatement("a", 3, { name: "Party", look: LOOK });
    expect(statement.text).toBe(
      "select accounts.outfit_save($1, $2, $3, $4, $5::int[], $6::int[], $7::int[]) as result",
    );
    expect(statement.values).toEqual([
      "a",
      3,
      "Party",
      0,
      LOOK.kits,
      LOOK.colours,
      LOOK.worn,
    ]);
  });

  it("ask about at most a hundred names", () => {
    const names = Array.from({ length: 150 }, (_, i) => `n${i}`);
    expect((defaultLooksStatement(names).values[0] as string[]).length).toBe(100);
    expect((gameLooksStatement(names).values[0] as string[]).length).toBe(100);
  });

  it("read game looks through the import function, one call per name", () => {
    const statement = gameLooksStatement(["a", "b"]);
    expect(statement.text).toContain("unnest($1::text[])");
    expect(statement.text).toContain("accounts.outfit_import_look(u.username)");
    expect(statement.text).toContain("l.result = 'ok'");
    expect(statement.values).toEqual([["a", "b"]]);
  });
});

describe("parseOutfits", () => {
  it("lays the rows out as ten slots and finds the default", () => {
    const saved = parseOutfits([
      row({ slot: 0, name: "Rune", is_default: false }),
      row({ slot: 7, name: "Party", is_default: true }),
    ]);
    expect(saved.outfits).toHaveLength(10);
    expect(saved.outfits[0]).toEqual({ name: "Rune", look: LOOK });
    expect(saved.outfits[3]).toBeNull();
    expect(saved.outfits[7]?.name).toBe("Party");
    expect(saved.defaultSlot).toBe(7);
  });

  it("is empty for no rows", () => {
    const saved = parseOutfits([]);
    expect(saved.outfits.every((slot) => slot === null)).toBe(true);
    expect(saved.defaultSlot).toBeNull();
  });

  it("throws on a row it cannot read rather than guessing", () => {
    expect(() => parseOutfits([row({ slot: 10, name: "x" })])).toThrow(/slot/);
    expect(() => parseOutfits([row({ slot: 0, name: "x", kits: [0] })])).toThrow(/kits/);
    expect(() => parseOutfits([row({ slot: 0, name: "x", gender: 2 })])).toThrow(/gender/);
  });
});

describe("parseOutfitWrite", () => {
  it("knows the documented answers and nothing else", () => {
    for (const answer of ["ok", "not_found", "banned", "bad_slot", "bad_name", "bad_look", "empty"]) {
      expect(parseOutfitWrite(answer, "w")).toBe(answer);
    }
    expect(() => parseOutfitWrite("maybe", "w")).toThrow(/maybe/);
  });
});

describe("parseOutfitImport", () => {
  it("reads the look, or why there is none", () => {
    expect(
      parseOutfitImport([row({ result: "ok", saved_at: new Date("2026-09-24T12:00:00Z") })]),
    ).toEqual({ result: "ok", look: LOOK, savedAt: "2026-09-24T12:00:00.000Z" });
    expect(parseOutfitImport([{ result: "no_look" }])).toEqual({ result: "no_look" });
    expect(parseOutfitImport([{ result: "not_found" }])).toEqual({ result: "not_found" });
  });

  it("insists on one row", () => {
    expect(() => parseOutfitImport([])).toThrow(/always one/);
  });
});

describe("parseDefaultLooks", () => {
  it("maps each name to its look", () => {
    const looks = parseDefaultLooks([row({ username: "zezima" })]);
    expect(looks.get("zezima")).toEqual(LOOK);
    expect(looks.size).toBe(1);
  });
});

describe("parseGameLooks", () => {
  it("maps each name to its look, and throws on a row it cannot read", () => {
    expect(parseGameLooks([row({ username: "zezima" })]).get("zezima")).toEqual(LOOK);
    expect(() => parseGameLooks([row({ username: "zezima", worn: [1] })])).toThrow(/worn/);
    expect(() => parseGameLooks([row({})])).toThrow(/not a row/);
  });
});

describe("outfitStatusFor", () => {
  it("gives each answer its status, and 500 to anything unknown", () => {
    expect(outfitStatusFor("ok")).toBe(200);
    expect(outfitStatusFor("bad_look")).toBe(400);
    expect(outfitStatusFor("banned")).toBe(403);
    expect(outfitStatusFor("no_look")).toBe(404);
    expect(outfitStatusFor("empty")).toBe(409);
    expect(outfitStatusFor("mystery")).toBe(500);
  });
});
