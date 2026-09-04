import { describe, expect, it } from "vitest";

import { clientIp, ipGroup, normalizeIp } from "./ip";

const headers = (values: Record<string, string>) => ({
  get: (name: string) => values[name.toLowerCase()] ?? null,
});

describe("normalizeIp", () => {
  it("unwraps an IPv4-mapped IPv6 address", () => {
    expect(normalizeIp("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(normalizeIp("::FFFF:203.0.113.7")).toBe("203.0.113.7");
  });

  it("leaves everything else alone bar case and padding", () => {
    expect(normalizeIp(" 2001:DB8::1 ")).toBe("2001:db8::1");
    expect(normalizeIp("203.0.113.7")).toBe("203.0.113.7");
  });
});

describe("ipGroup", () => {
  it("groups IPv4 by /24", () => {
    expect(ipGroup("203.0.113.7")).toBe("203.0.113.0/24");
    expect(ipGroup("203.0.113.250")).toBe("203.0.113.0/24");
    expect(ipGroup("203.0.114.7")).not.toBe(ipGroup("203.0.113.7"));
  });

  it("groups an IPv4-mapped address as IPv4", () => {
    expect(ipGroup("::ffff:203.0.113.7")).toBe("203.0.113.0/24");
  });

  it("groups IPv6 by /64, so one household is one bucket", () => {
    // A residential customer holds a whole /64 and can mint a fresh address
    // per request; a /24-only rule would be free to bypass.
    expect(ipGroup("2001:db8:1234:5678:9abc:def0:1234:5678")).toBe(
      "2001:0db8:1234:5678::/64",
    );
    expect(ipGroup("2001:db8:1234:5678::1")).toBe("2001:0db8:1234:5678::/64");
    expect(ipGroup("2001:db8:1234:5678::1")).toBe(
      ipGroup("2001:db8:1234:5678:ffff::9"),
    );
    expect(ipGroup("2001:db8:1234:9999::1")).not.toBe(
      ipGroup("2001:db8:1234:5678::1"),
    );
  });

  it("handles the compressed ends of an address", () => {
    expect(ipGroup("::1")).toBe("0000:0000:0000:0000::/64");
    expect(ipGroup("2001:db8::")).toBe("2001:0db8:0000:0000::/64");
  });

  it("keeps an unparseable value distinct rather than collapsing it", () => {
    expect(ipGroup("not-an-ip")).toBe("not-an-ip");
    expect(ipGroup("1.2.3")).toBe("1.2.3");
    expect(ipGroup("999.1.1.1")).toBe("999.1.1.1");
  });
});

describe("clientIp", () => {
  it("takes the first entry of x-forwarded-for", () => {
    expect(
      clientIp(headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18" })),
    ).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIp(headers({ "x-real-ip": "203.0.113.7" }))).toBe(
      "203.0.113.7",
    );
  });

  it("is null when the platform told us nothing", () => {
    expect(clientIp(headers({}))).toBeNull();
    expect(clientIp(headers({ "x-forwarded-for": "" }))).toBeNull();
  });
});
