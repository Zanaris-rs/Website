import { describe, expect, it } from "vitest";

import { submitState } from "./submit";

describe("submitState", () => {
  it("waits for the first token", () => {
    const state = submitState({
      configured: true,
      token: null,
      submitting: false,
    });
    expect(state.disabled).toBe(true);
    expect(state.label).toBe("Waiting for the anti-bot check…");
  });

  it("enables submit once a token arrives", () => {
    expect(
      submitState({ configured: true, token: "t", submitting: false }),
    ).toEqual({ disabled: false, label: "Create account" });
  });

  it("goes back to waiting when the token expires or errors", () => {
    // Both Turnstile callbacks set the token back to null; the button has to
    // follow it back rather than posting a token that is already spent.
    const expired = submitState({
      configured: true,
      token: null,
      submitting: false,
    });
    expect(expired.disabled).toBe(true);
    expect(expired.label).toBe("Waiting for the anti-bot check…");
  });

  it("stays disabled while a registration is in flight", () => {
    expect(
      submitState({ configured: true, token: "t", submitting: true }),
    ).toEqual({ disabled: true, label: "Creating..." });
  });

  it("does not promise a check that will never come when unconfigured", () => {
    // The form already says "registration is closed" above the button, so the
    // label stays neutral rather than implying something is loading.
    expect(
      submitState({ configured: false, token: null, submitting: false }),
    ).toEqual({ disabled: true, label: "Create account" });
  });
});
