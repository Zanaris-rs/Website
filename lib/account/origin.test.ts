import { describe, expect, it } from "vitest";

import {
  assertSameOrigin,
  assertSameOriginFetch,
  requestHost,
  sameOrigin,
} from "./origin";

function headers(entries: Record<string, string>) {
  return new Headers(entries);
}

describe("sameOrigin", () => {
  it("accepts our own origin", () => {
    expect(sameOrigin("https://zanaris.rs", "zanaris.rs")).toBe(true);
    expect(sameOrigin("http://localhost:3000", "localhost:3000")).toBe(true);
  });

  it("ignores the scheme, because the proxy terminates TLS", () => {
    // The browser says https; the request reaching the function need not be.
    expect(sameOrigin("https://zanaris.rs", "zanaris.rs")).toBe(true);
    expect(sameOrigin("http://zanaris.rs", "zanaris.rs")).toBe(true);
  });

  it("compares the port, so 3000 is not 3001", () => {
    expect(sameOrigin("http://localhost:3000", "localhost:3001")).toBe(false);
    expect(sameOrigin("http://localhost:3000", "localhost")).toBe(false);
  });

  it("rejects another site, including a lookalike prefix", () => {
    expect(sameOrigin("https://evil.example", "zanaris.rs")).toBe(false);
    expect(sameOrigin("https://zanaris.rs.evil.example", "zanaris.rs")).toBe(
      false,
    );
    // www is a different host: it 308s to the apex, and the cookie is host-only.
    expect(sameOrigin("https://www.zanaris.rs", "zanaris.rs")).toBe(false);
  });

  it("rejects a missing Origin — a browser always sends one on a POST", () => {
    expect(sameOrigin(null, "zanaris.rs")).toBe(false);
    expect(sameOrigin(undefined, "zanaris.rs")).toBe(false);
    expect(sameOrigin("", "zanaris.rs")).toBe(false);
  });

  it("rejects the literal `null` origin", () => {
    // A sandboxed iframe or a data: document. It names no site, so it cannot
    // name ours; treating it as a wildcard is the classic mistake here.
    expect(sameOrigin("null", "zanaris.rs")).toBe(false);
  });

  it("rejects an unparseable origin, and a missing host", () => {
    expect(sameOrigin("not a url", "zanaris.rs")).toBe(false);
    expect(sameOrigin("https://zanaris.rs", null)).toBe(false);
  });

  it("is case-insensitive about the host, as DNS is", () => {
    expect(sameOrigin("https://ZANARIS.rs", "zanaris.rs")).toBe(true);
    expect(sameOrigin("https://zanaris.rs", " Zanaris.RS ")).toBe(true);
  });
});

describe("requestHost", () => {
  it("prefers x-forwarded-host, which is what the browser addressed", () => {
    expect(
      requestHost(
        headers({ "x-forwarded-host": "zanaris.rs", host: "internal:3000" }),
      ),
    ).toBe("zanaris.rs");
  });

  it("falls back to host", () => {
    expect(requestHost(headers({ host: "localhost:3000" }))).toBe(
      "localhost:3000",
    );
  });

  it("is null when neither is present", () => {
    expect(requestHost(headers({}))).toBeNull();
  });
});

describe("assertSameOrigin", () => {
  it("passes a same-site POST", () => {
    expect(
      assertSameOrigin(
        headers({ origin: "https://zanaris.rs", "x-forwarded-host": "zanaris.rs" }),
      ),
    ).toBe(true);
  });

  it("fails a cross-site POST", () => {
    expect(
      assertSameOrigin(
        headers({
          origin: "https://evil.example",
          "x-forwarded-host": "zanaris.rs",
        }),
      ),
    ).toBe(false);
  });

  it("fails a POST with no Origin at all", () => {
    expect(assertSameOrigin(headers({ "x-forwarded-host": "zanaris.rs" }))).toBe(
      false,
    );
  });
});

describe("assertSameOriginFetch", () => {
  it("passes a fetch from one of our own pages", () => {
    expect(assertSameOriginFetch(headers({ "sec-fetch-site": "same-origin" }))).toBe(
      true,
    );
  });

  it("fails the cross-site link that would mark a message read", () => {
    // A link on somebody else's page, followed by a signed-in reader: Lax
    // sends the cookie on a top-level GET, and `accounts.message` writes.
    expect(assertSameOriginFetch(headers({ "sec-fetch-site": "cross-site" }))).toBe(
      false,
    );
    // www.zanaris.rs is a subdomain, so a link from one would say `same-site`.
    // It 308s to the apex and the cookie is host-only; it is not us either.
    expect(assertSameOriginFetch(headers({ "sec-fetch-site": "same-site" }))).toBe(
      false,
    );
  });

  it("fails a direct address-bar visit, which says `none`", () => {
    // Not a loss: the pages read the database themselves, and these routes
    // exist for fetch. Answering 403 keeps the rule one word long.
    expect(assertSameOriginFetch(headers({ "sec-fetch-site": "none" }))).toBe(false);
  });

  it("fails a request with no Sec-Fetch-Site at all", () => {
    // A browser too old to send it, or a client that is not a browser. Fail
    // closed: nothing the site itself does is missing this header.
    expect(assertSameOriginFetch(headers({}))).toBe(false);
    expect(assertSameOriginFetch(headers({ "sec-fetch-site": "SAME-ORIGIN" }))).toBe(
      false,
    );
  });
});
