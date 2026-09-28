import { describe, expect, it } from "vitest";

import { editorStatusText } from "./editor-status";

describe("editorStatusText", () => {
  it("says what the check refuses before anything else", () => {
    expect(
      editorStatusText({ checkError: "name must be 1 to 32 characters", status: { text: "Saved.", done: true }, dirty: true }),
    ).toBe("name must be 1 to 32 characters");
  });

  it("says what a request did while the draft is what it saved", () => {
    expect(editorStatusText({ checkError: null, status: { text: "Saved.", done: true }, dirty: false })).toBe("Saved.");
    expect(editorStatusText({ checkError: null, status: { text: "Deleted.", done: true }, dirty: false })).toBe("Deleted.");
  });

  it("never says only 'Saved.' over an edit made while it saved", () => {
    expect(editorStatusText({ checkError: null, status: { text: "Saved.", done: true }, dirty: true })).toBe(
      "Saved. You have changed it since.",
    );
    expect(
      editorStatusText({ checkError: null, status: { text: "Saved. You're wearing it now.", done: true }, dirty: true }),
    ).toBe("Saved. You're wearing it now. You have changed it since.");
  });

  it("keeps a message that is about the draft, such as an import or a refusal, as it is", () => {
    const imported = "Imported your look from your last save. Save to keep it.";
    expect(editorStatusText({ checkError: null, status: { text: imported, done: false }, dirty: true })).toBe(imported);
    expect(editorStatusText({ checkError: null, status: { text: "The game would not allow that outfit.", done: false }, dirty: true })).toBe(
      "The game would not allow that outfit.",
    );
  });

  it("otherwise says whether there are unsaved changes, or nothing", () => {
    expect(editorStatusText({ checkError: null, status: null, dirty: true })).toBe("You have unsaved changes.");
    expect(editorStatusText({ checkError: null, status: null, dirty: false })).toBe("");
  });
});
