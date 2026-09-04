import { readFileSync } from "node:fs";
import { X509Certificate } from "node:crypto";

import { describe, expect, it } from "vitest";

import { SUPABASE_ROOT_CA } from "./supabase-ca";

/**
 * The shipped CA is what makes `rejectUnauthorized: true` possible at all, so
 * a corrupted or swapped certificate must fail here rather than as a
 * connection error in production.
 */
describe("the vendored Supabase root CA", () => {
  const certificate = new X509Certificate(SUPABASE_ROOT_CA);

  it("parses as an X.509 certificate", () => {
    expect(certificate.subject).toBeTruthy();
  });

  it("is the Supabase root, by subject", () => {
    expect(certificate.subject).toContain("CN=Supabase Root 2021 CA");
    expect(certificate.subject).toContain("O=Supabase Inc");
  });

  it("is self-signed, which is why no public store carries it", () => {
    expect(certificate.issuer).toBe(certificate.subject);
    expect(certificate.verify(certificate.publicKey)).toBe(true);
  });

  it("is the certificate captured from the live pooler chain", () => {
    // Recorded 2026-09-04 from
    // `openssl s_client -connect aws-0-us-east-1.pooler.supabase.com:6543
    //    -starttls postgres -showcerts`, which validated with this as the
    // sole trust root. A different fingerprint means a different CA.
    expect(certificate.fingerprint256).toBe(
      "80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA",
    );
  });

  it("has not expired", () => {
    const now = Date.now();
    expect(new Date(certificate.validFrom).getTime()).toBeLessThan(now);
    // Expires 2031-04-26. When this fails, the pooler has almost certainly
    // moved to a new root and `lib/supabase-ca.ts` needs regenerating.
    expect(new Date(certificate.validTo).getTime()).toBeGreaterThan(now);
  });

  it("matches lib/supabase-root-2021.crt, so the two cannot drift", () => {
    // The `.crt` is the human-inspectable artifact you would diff against the
    // Supabase dashboard; the constant is what actually ships, because a
    // runtime `readFileSync` would depend on bundle tracing.
    const onDisk = readFileSync(
      new URL("./supabase-root-2021.crt", import.meta.url),
      "utf8",
    );
    expect(SUPABASE_ROOT_CA.trim()).toBe(onDisk.trim());
  });
});
