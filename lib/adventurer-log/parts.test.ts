import { describe, expect, it } from "vitest";

import {
  checkShowsInput,
  isPartHidden,
  PART_BITS,
  PART_KEYS,
  PART_LABELS,
  partsMaskOf,
  PARTS_MASK_MAX,
  readPart,
  schematic,
} from "./parts";
import { parseLog } from "./queries";

describe("the log's parts", () => {
  it("are migration 18's five bits, in the settings' order", () => {
    expect(PART_KEYS).toEqual(["dialogue", "wardrobe", "records", "about", "adventures"]);
    expect(PART_BITS).toEqual({ dialogue: 1, wardrobe: 2, records: 4, about: 8, adventures: 16 });
    expect(PARTS_MASK_MAX).toBe(31);
    expect(partsMaskOf(PART_KEYS)).toBe(PARTS_MASK_MAX);
    expect(PART_KEYS.map((key) => PART_LABELS[key])).toEqual(["Dialogue", "Wardrobe", "Records", "About", "Adventures"]);
  });

  it("make a mask, and say what one hides", () => {
    const mask = partsMaskOf(["about", "records", "about"]);
    expect(mask).toBe(12);
    expect(isPartHidden(mask, "about")).toBe(true);
    expect(isPartHidden(mask, "records")).toBe(true);
    expect(isPartHidden(mask, "dialogue")).toBe(false);
    expect(partsMaskOf([])).toBe(0);
    for (const key of PART_KEYS) expect(isPartHidden(0, key)).toBe(false);
  });
});

describe("readPart", () => {
  const counted = () => {
    const calls = { reads: 0 };
    return { calls, read: async () => (calls.reads++, "the part") };
  };

  it("reads a part that is shown", async () => {
    const { calls, read } = counted();
    expect(await readPart(0, "adventures", read, "empty")).toBe("the part");
    expect(await readPart(partsMaskOf(["about", "records"]), "adventures", read, "empty")).toBe("the part");
    expect(calls.reads).toBe(2);
  });

  it("answers what an empty part answers for a hidden one, and reads nothing", async () => {
    const { calls, read } = counted();
    expect(await readPart(partsMaskOf(["adventures"]), "adventures", read, "empty")).toBe("empty");
    expect(await readPart(PARTS_MASK_MAX, "records", read, null)).toBeNull();
    expect(await readPart(PART_BITS.wardrobe, "wardrobe", read, [])).toEqual([]);
    expect(calls.reads).toBe(0);
  });
});

describe("the header's hidden parts", () => {
  it("are read up to every part hidden, and no further", () => {
    const row = {
      result: "ok", username: "hero", joined_at: "2026-09-01T00:00:00Z", about: "", custom_css: "",
      css_disabled: false, hidden_categories: 0, is_owner: false, viewer_blocked: false, viewer_can_post: false,
      greeting: "", greeting_colour: 0, greeting_effect: 0,
    };
    expect(parseLog([{ ...row, hidden_parts: PARTS_MASK_MAX }])).toMatchObject({ hiddenParts: PARTS_MASK_MAX });
    expect(() => parseLog([{ ...row, hidden_parts: PARTS_MASK_MAX + 1 }])).toThrow(/hidden_parts/);
  });
});

describe("checkShowsInput", () => {
  it("turns what Log settings sends into the two masks", () => {
    expect(checkShowsInput({ hiddenCategories: [4, 5], hiddenParts: ["about", "records"] })).toEqual({
      ok: true,
      value: { categories: (1 << 4) | (1 << 5), parts: 12 },
    });
    expect(checkShowsInput({ hiddenCategories: [], hiddenParts: [] })).toEqual({
      ok: true,
      value: { categories: 0, parts: 0 },
    });
  });

  it.each([
    ["no body", null],
    ["a list", []],
    ["no categories", { hiddenParts: [] }],
    ["no parts", { hiddenCategories: [] }],
    ["a category nobody files", { hiddenCategories: [42], hiddenParts: [] }],
    ["a category that is text", { hiddenCategories: ["4"], hiddenParts: [] }],
    ["a part that is always shown", { hiddenCategories: [], hiddenParts: ["skills"] }],
    ["the card", { hiddenCategories: [], hiddenParts: ["card"] }],
    ["a part that is a bit", { hiddenCategories: [], hiddenParts: [8] }],
    ["parts that are a mask", { hiddenCategories: [], hiddenParts: 8 }],
  ])("refuses %s", (_what, raw) => {
    expect(checkShowsInput(raw)).toEqual({ ok: false, error: "bad_request" });
  });
});

describe("schematic", () => {
  const names = (mask: number) => {
    const { side, main } = schematic(mask);
    return [side.map((block) => block.key), main.map((block) => block.key)];
  };

  it("is the log's two columns, top to bottom", () => {
    expect(names(0)).toEqual([["card", "wardrobe", "skills", "records"], ["dialogue", "about", "adventures"]]);
    expect(schematic(0).side[0]).toEqual({ key: "card", label: "Character card", height: 92 });
  });

  it("drops what is hidden, and never the card or Skills", () => {
    expect(names(partsMaskOf(["wardrobe", "about"]))).toEqual([["card", "skills", "records"], ["dialogue", "adventures"]]);
    expect(names(PARTS_MASK_MAX)).toEqual([["card", "skills"], []]);
  });
});
