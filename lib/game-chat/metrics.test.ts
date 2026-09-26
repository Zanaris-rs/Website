import { describe, expect, it } from "vitest";

import metrics from "./metrics.json";
import { stringWidth } from "./metrics";

describe("stringWidth (PixFont.stringWid)", () => {
  it("reproduces every width the build measured with the client's own PixFont", () => {
    for (const font of ["b12", "p12"] as const) {
      for (const [text, width] of Object.entries(metrics.fonts[font].samples)) {
        expect(stringWidth(text, font), `${font} ${JSON.stringify(text)}`).toBe(width);
      }
    }
  });
  it("skips a colour tag, as the client does", () => {
    expect(stringWidth("@red@hi", "b12")).toBe(stringWidth("hi", "b12"));
  });
});
