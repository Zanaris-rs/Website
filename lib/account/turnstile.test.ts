import { describe, expect, it, vi } from "vitest";

import { verifyTurnstile } from "./turnstile";

const json = (body: unknown, ok = true) =>
  ({ ok, json: async () => body }) as unknown as Response;

const SECRET = "1x0000000000000000000000000000000AA";

describe("verifyTurnstile", () => {
  it("accepts a success", async () => {
    const fetchImpl = vi.fn(async () => json({ success: true }));
    expect(
      await verifyTurnstile({
        token: "t",
        secret: SECRET,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).toBe(true);
  });

  it("posts the form Cloudflare expects, with remoteip", async () => {
    const fetchImpl = vi.fn(async () => json({ success: true }));
    await verifyTurnstile({
      token: "t",
      secret: SECRET,
      remoteIp: "203.0.113.7",
      fetchImpl: fetchImpl as unknown as typeof fetch,
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
    const fetchImpl = vi.fn(async () => json({ success: true }));
    expect(
      await verifyTurnstile({
        token: "t",
        secret: undefined,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed with no token", async () => {
    expect(await verifyTurnstile({ token: "", secret: SECRET })).toBe(false);
    expect(await verifyTurnstile({ token: null, secret: SECRET })).toBe(false);
  });

  it("fails closed on success: false", async () => {
    const fetchImpl = vi.fn(async () =>
      json({ success: false, "error-codes": ["invalid-input-response"] }),
    );
    expect(
      await verifyTurnstile({
        token: "bad",
        secret: SECRET,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).toBe(false);
  });

  it("fails closed on a non-2xx", async () => {
    const fetchImpl = vi.fn(async () => json({ success: true }, false));
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
    for (const body of [null, "yes", { success: "true" }, {}]) {
      const fetchImpl = vi.fn(async () => json(body));
      expect(
        await verifyTurnstile({
          token: "t",
          secret: SECRET,
          fetchImpl: fetchImpl as unknown as typeof fetch,
        }),
      ).toBe(false);
    }
  });
});
