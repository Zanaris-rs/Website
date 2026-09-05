import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_ALLOWED_TURNSTILE_HOSTNAMES,
  TURNSTILE_ACTION,
  allowedHostnames,
  hostnameAllowed,
  verifyTurnstile,
} from "./turnstile";

const json = (body: unknown, ok = true) =>
  ({ ok, json: async () => body }) as unknown as Response;

const SECRET = "1x0000000000000000000000000000000AA";

/** What Cloudflare returns for a challenge our own register page solved. */
const PASS = {
  success: true,
  action: "signup",
  hostname: "zanaris.rs",
  challenge_ts: "2026-09-05T00:00:00.000Z",
};

const ok = (body: unknown = PASS) => vi.fn(async () => json(body));
const impl = (fn: ReturnType<typeof ok>) => fn as unknown as typeof fetch;

describe("verifyTurnstile", () => {
  it("accepts a success for our action on our hostname", async () => {
    const fetchImpl = ok();
    expect(
      await verifyTurnstile({
        token: "t",
        secret: SECRET,
        fetchImpl: impl(fetchImpl),
      }),
    ).toBe(true);
  });

  it("posts the form Cloudflare expects, with remoteip", async () => {
    const fetchImpl = ok();
    await verifyTurnstile({
      token: "t",
      secret: SECRET,
      remoteIp: "203.0.113.7",
      fetchImpl: impl(fetchImpl),
    });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    );
    expect(init.method).toBe("POST");
    const body = init.body as URLSearchParams;
    expect(body.get("secret")).toBe(SECRET);
    expect(body.get("response")).toBe("t");
    expect(body.get("remoteip")).toBe("203.0.113.7");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  // Each of these is a way the gate could quietly stop being a gate.
  it("fails closed with no secret configured", async () => {
    const fetchImpl = ok();
    expect(
      await verifyTurnstile({
        token: "t",
        secret: undefined,
        fetchImpl: impl(fetchImpl),
      }),
    ).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed with no token", async () => {
    expect(await verifyTurnstile({ token: "", secret: SECRET })).toBe(false);
    expect(await verifyTurnstile({ token: null, secret: SECRET })).toBe(false);
  });

  it("fails closed on success: false", async () => {
    const fetchImpl = ok({
      success: false,
      "error-codes": ["invalid-input-response"],
    });
    expect(
      await verifyTurnstile({
        token: "bad",
        secret: SECRET,
        fetchImpl: impl(fetchImpl),
      }),
    ).toBe(false);
  });

  it("fails closed on a non-2xx", async () => {
    const fetchImpl = vi.fn(async () => json(PASS, false));
    expect(
      await verifyTurnstile({
        token: "t",
        secret: SECRET,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).toBe(false);
  });

  it("fails closed on a network error or timeout", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network");
    });
    expect(
      await verifyTurnstile({
        token: "t",
        secret: SECRET,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).toBe(false);
  });

  it("fails closed on a body that is not the documented shape", async () => {
    for (const body of [null, "yes", { ...PASS, success: "true" }, {}]) {
      const fetchImpl = ok(body);
      expect(
        await verifyTurnstile({
          token: "t",
          secret: SECRET,
          fetchImpl: impl(fetchImpl),
        }),
      ).toBe(false);
    }
  });

  // The site key is public, so `success: true` on its own only proves that
  // *somebody* solved *some* challenge for our widget. These two fields are
  // what make it our challenge, on our page.
  it("rejects a token minted for a different action", async () => {
    const fetchImpl = ok({ ...PASS, action: "login" });
    expect(
      await verifyTurnstile({
        token: "t",
        secret: SECRET,
        fetchImpl: impl(fetchImpl),
      }),
    ).toBe(false);
  });

  it("rejects a token solved on a hostname that is not ours", async () => {
    for (const hostname of [
      "evil.example",
      "zanaris.rs.evil.example",
      "notzanaris.rs",
      "sub.zanaris.rs",
    ]) {
      const fetchImpl = ok({ ...PASS, hostname });
      expect(
        await verifyTurnstile({
          token: "t",
          secret: SECRET,
          fetchImpl: impl(fetchImpl),
        }),
      ).toBe(false);
    }
  });

  it("rejects a response missing action or hostname entirely", async () => {
    // A widget rendered without an action verifies fine at Cloudflare and must
    // still not open an account here.
    const bodies = [
      { success: true, hostname: "zanaris.rs" },
      { success: true, action: "signup" },
      { success: true, action: null, hostname: "zanaris.rs" },
      { success: true, action: "signup", hostname: null },
      { success: true, action: "signup", hostname: "" },
    ];
    for (const body of bodies) {
      const fetchImpl = ok(body);
      expect(
        await verifyTurnstile({
          token: "t",
          secret: SECRET,
          fetchImpl: impl(fetchImpl),
        }),
      ).toBe(false);
    }
  });

  it("accepts every hostname on the default list", async () => {
    for (const hostname of DEFAULT_ALLOWED_TURNSTILE_HOSTNAMES) {
      const fetchImpl = ok({ ...PASS, hostname });
      expect(
        await verifyTurnstile({
          token: "t",
          secret: SECRET,
          fetchImpl: impl(fetchImpl),
        }),
      ).toBe(true);
    }
  });

  it("honours an explicit action and hostname list", async () => {
    const fetchImpl = ok({ ...PASS, action: "other", hostname: "staging.dev" });
    expect(
      await verifyTurnstile({
        token: "t",
        secret: SECRET,
        expectedAction: "other",
        allowedHostnames: ["staging.dev"],
        fetchImpl: impl(fetchImpl),
      }),
    ).toBe(true);
  });

  it("refuses everything when the allowed list is empty", async () => {
    const fetchImpl = ok();
    expect(
      await verifyTurnstile({
        token: "t",
        secret: SECRET,
        allowedHostnames: [],
        fetchImpl: impl(fetchImpl),
      }),
    ).toBe(false);
  });
});

describe("allowedHostnames", () => {
  it("falls back to the default list when unset or blank", () => {
    // A variable nobody set must not be the thing that turns the check off.
    expect(allowedHostnames(undefined)).toEqual(
      DEFAULT_ALLOWED_TURNSTILE_HOSTNAMES,
    );
    expect(allowedHostnames(null)).toEqual(DEFAULT_ALLOWED_TURNSTILE_HOSTNAMES);
    expect(allowedHostnames("")).toEqual(DEFAULT_ALLOWED_TURNSTILE_HOSTNAMES);
    expect(allowedHostnames("  , ,")).toEqual(
      DEFAULT_ALLOWED_TURNSTILE_HOSTNAMES,
    );
  });

  it("parses a comma-separated list, trimmed and lower-cased", () => {
    expect(allowedHostnames(" Zanaris.RS , localhost ")).toEqual([
      "zanaris.rs",
      "localhost",
    ]);
  });

  it("covers the live site, local dev and our Vercel host by default", () => {
    expect(DEFAULT_ALLOWED_TURNSTILE_HOSTNAMES).toEqual([
      "zanaris.rs",
      "www.zanaris.rs",
      "zanaris.vercel.app",
      "localhost",
      "127.0.0.1",
    ]);
  });
});

describe("hostnameAllowed", () => {
  it("matches exactly, case-insensitively", () => {
    expect(hostnameAllowed("ZANARIS.rs", ["zanaris.rs"])).toBe(true);
    expect(hostnameAllowed(" zanaris.rs ", ["zanaris.rs"])).toBe(true);
    expect(hostnameAllowed("zanaris.rs.evil.example", ["zanaris.rs"])).toBe(
      false,
    );
    expect(hostnameAllowed("", ["zanaris.rs"])).toBe(false);
  });

  it("matches a subdomain wildcard, but not the bare suffix", () => {
    const allowed = ["*.vercel.app"];
    expect(hostnameAllowed("zanaris-git-main.vercel.app", allowed)).toBe(true);
    expect(hostnameAllowed("a.b.vercel.app", allowed)).toBe(true);
    expect(hostnameAllowed("vercel.app", allowed)).toBe(false);
    expect(hostnameAllowed(".vercel.app", allowed)).toBe(false);
    expect(hostnameAllowed("evilvercel.app", allowed)).toBe(false);
  });
});

describe("TURNSTILE_ACTION", () => {
  it("is the action the register widget renders with", () => {
    // The form imports this same constant, precisely so the two cannot drift.
    expect(TURNSTILE_ACTION).toBe("signup");
  });
});
