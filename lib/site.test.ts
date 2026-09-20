import { describe, expect, it } from "vitest";

import { ENGINE_BRANCH, ENGINE_SOURCES, engineFile } from "./site";

describe("engineFile", () => {
  it("points at the branch the fleet runs, not at a default one", () => {
    expect(engineFile("tools/server/SaveCensus.ts")).toBe(
      `https://github.com/Zanaris-rs/Engine-TS/blob/${ENGINE_BRANCH}/tools/server/SaveCensus.ts`,
    );
  });

  it("names a real path for every source the about page cites", () => {
    for (const path of Object.values(ENGINE_SOURCES)) {
      expect(path).toMatch(/^[\w./-]+$/);
      expect(path.startsWith("/")).toBe(false);
    }
  });
});
