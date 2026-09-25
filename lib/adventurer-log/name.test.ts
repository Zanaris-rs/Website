import { describe, expect, it } from "vitest";

import { nameFrom } from "./name";

describe("nameFrom", () => {
  it("decodes a URL segment to the stored name", () => {
    expect(nameFrom("zezima")).toBe("zezima");
    expect(nameFrom("Lynx%20Titan")).toBe("lynx_titan");
  });

  it("is null for a malformed escape", () => {
    expect(nameFrom("%E0%A4%A")).toBeNull();
  });

  it("is null for a name base37 cannot hold", () => {
    expect(nameFrom("!!!")).toBeNull();
    expect(nameFrom("")).toBeNull();
  });
});
