import { describe, expect, it } from "vitest";

import {
  SESSION_EXPIRED,
  SESSION_UNAVAILABLE,
  type LiveSessionVerdict,
  refusalFor,
} from "./live-session";

/**
 * The mapping `requireLiveSession` applies, tested where it can be: the helper
 * itself imports `next/headers` and `server-only` and so cannot be loaded
 * under vitest, but the part that decides what the caller answers is here.
 *
 * The values are the ones the six Message Centre routes send, and the README
 * writes them down as the contract — 401 `session_expired`, 503 `unavailable`.
 */

describe("refusalFor", () => {
  it("turns a revoked cookie into 401 session_expired", () => {
    // A password changed on another device: `loadAccount` says `signed_out`
    // because the salt fingerprint no longer matches. This is the whole point
    // of the check — before it, such a cookie kept working on these routes.
    expect(refusalFor("signed_out")).toEqual({
      error: "session_expired",
      status: 401,
    });
  });

  it("gives a missing cookie the same 401, indistinguishably", () => {
    // No cookie, a forged one and a revoked one are one answer: a caller that
    // could tell them apart would be somewhere to probe from, and every one of
    // them means the same thing to the page — log in again.
    expect(refusalFor("no_cookie")).toEqual(refusalFor("signed_out"));
    expect(refusalFor("no_cookie")).toBe(SESSION_EXPIRED);
  });

  it("does not sign anybody out because the database is down", () => {
    // `unavailable` is not a verdict about the cookie. Answering 401 here
    // would bounce a perfectly good session to the login form every time
    // Supabase blinked — and the login form needs the same database.
    expect(refusalFor("unavailable")).toEqual({
      error: "unavailable",
      status: 503,
    });
    expect(refusalFor("unavailable")).toBe(SESSION_UNAVAILABLE);
  });

  it("answers with a status for every verdict, and only 401 or 503", () => {
    const verdicts: LiveSessionVerdict[] = [
      "no_cookie",
      "signed_out",
      "unavailable",
    ];

    for (const verdict of verdicts) {
      const refusal = refusalFor(verdict);
      expect([401, 503]).toContain(refusal.status);
      expect(refusal.status === 401).toBe(refusal.error === "session_expired");
    }
  });
});
