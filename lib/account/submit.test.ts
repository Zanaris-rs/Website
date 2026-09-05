import { describe, expect, it } from "vitest";

import { LOGIN_LABELS, REGISTER_LABELS, submitState } from "./submit";

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

describe("submitState with the login labels", () => {
  it("says Login, and Logging in... while it is", () => {
    expect(
      submitState({
        configured: true,
        token: "t",
        submitting: false,
        labels: LOGIN_LABELS,
      }),
    ).toEqual({ disabled: false, label: "Login" });

    expect(
      submitState({
        configured: true,
        token: "t",
        submitting: true,
        labels: LOGIN_LABELS,
      }),
    ).toEqual({ disabled: true, label: "Logging in..." });
  });

  it("still waits for a token, with the same wording either form", () => {
    const register = submitState({
      configured: true,
      token: null,
      submitting: false,
    });
    const login = submitState({
      configured: true,
      token: null,
      submitting: false,
      labels: LOGIN_LABELS,
    });
    expect(login).toEqual(register);
    expect(login.disabled).toBe(true);
  });

  it("defaults to the register wording when no labels are given", () => {
    expect(
      submitState({ configured: true, token: "t", submitting: false }).label,
    ).toBe(REGISTER_LABELS.idle);
  });
});
