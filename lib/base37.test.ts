import { describe, expect, it } from "vitest";

import {
  fromBase37,
  INVALID_NAME,
  toBase37,
  toDisplayName,
  toSafeName,
  toTitleCase,
} from "./base37";
import fixture from "./base37-fixture.json";

/**
 * `lib/base37-fixture.json` was produced by running the *engine's*
 * `src/util/JString.ts` (unmodified) over these inputs, so this file is a
 * cross-repo contract test, not a restatement of the implementation. If the
 * engine's encoding ever moves, regenerate the fixture and this fails loudly
 * instead of silently handing players a different username than the one the
 * register form promised them.
 */
describe("base37, against engine fixtures", () => {
  for (const row of fixture.rows) {
    it(`encodes ${JSON.stringify(row.input)}`, () => {
      expect(toBase37(row.input).toString()).toBe(row.base37);
      expect(toSafeName(row.input)).toBe(row.safeName);
      expect(toDisplayName(row.input)).toBe(row.displayName);
    });
  }

  for (const row of fixture.decode) {
    it(`decodes ${row.value}`, () => {
      expect(fromBase37(BigInt(row.value))).toBe(row.name);
    });
  }

  for (const row of fixture.titleCase) {
    it(`title-cases ${JSON.stringify(row.input)}`, () => {
      expect(toTitleCase(row.input)).toBe(row.output);
    });
  }
});

describe("base37 behaviour players will hit", () => {
  it("drops trailing underscores, which is why the form previews the name", () => {
    expect(toSafeName("bob_")).toBe("bob");
    expect(toSafeName("bob___")).toBe("bob");
  });

  it("keeps interior underscores", () => {
    expect(toSafeName("bo_b")).toBe("bo_b");
  });

  it("truncates past 12 characters", () => {
    expect(toSafeName("abcdefghijklmnop")).toBe("abcdefghijkl");
  });

  it("folds case, so two spellings are the same account", () => {
    expect(toSafeName("BoB")).toBe(toSafeName("bob"));
  });

  it("reports names that cannot be encoded at all", () => {
    expect(toSafeName("")).toBe(INVALID_NAME);
    expect(toSafeName("!!!")).toBe(INVALID_NAME);
  });

  it("round-trips every safe name", () => {
    for (const name of ["bob", "the_inducted", "w0rld", "t_b_o_w"]) {
      expect(toSafeName(name)).toBe(name);
    }
  });
});
