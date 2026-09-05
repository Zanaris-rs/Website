import { describe, expect, it } from "vitest";

import { fakeSalt, sessionVersion } from "./salt";
import {
  SESSION_COOKIE,
  SESSION_SECRET_MIN_LENGTH,
  SESSION_TTL_SECONDS,
  clearedSessionCookieOptions,
  newSession,
  sessionCookieOptions,
  sessionSecret,
  signSession,
  verifySession,
} from "./session";

const SECRET = "0123456789abcdef0123456789abcdef";
const OTHER_SECRET = "fedcba9876543210fedcba9876543210";
const NOW = Date.parse("2026-09-05T12:00:00Z");
const SV = sessionVersion(fakeSalt(SECRET, "bob_smith"));

function token(now = NOW, secret = SECRET): string {
  return signSession(newSession("bob_smith", SV, now), secret);
}

describe("sessionSecret", () => {
  it("is null when unset, blank or too short — the fail-closed rule", () => {
    expect(sessionSecret(undefined)).toBeNull();
    expect(sessionSecret(null)).toBeNull();
    expect(sessionSecret("")).toBeNull();
    expect(sessionSecret("   ")).toBeNull();
    expect(sessionSecret("x".repeat(SESSION_SECRET_MIN_LENGTH - 1))).toBeNull();
  });

  it("accepts a secret of the minimum length, trimmed", () => {
    const secret = "x".repeat(SESSION_SECRET_MIN_LENGTH);
    expect(sessionSecret(secret)).toBe(secret);
    expect(sessionSecret(` ${secret} `)).toBe(secret);
  });
});

describe("the session round trip", () => {
  it("signs and verifies, giving back exactly what went in", () => {
    const session = newSession("bob_smith", SV, NOW);
    expect(verifySession(signSession(session, SECRET), SECRET, NOW)).toEqual(
      session,
    );
  });

  it("expires seven days out, to the second", () => {
    const session = newSession("bob_smith", SV, NOW);
    expect(session.exp - session.iat).toBe(SESSION_TTL_SECONDS);
    expect(session.exp).toBe(Math.floor(NOW / 1000) + SESSION_TTL_SECONDS);
  });

  it("is still valid a second before expiry and gone a second after", () => {
    const signed = token();
    const expiry = (Math.floor(NOW / 1000) + SESSION_TTL_SECONDS) * 1000;
    expect(verifySession(signed, SECRET, expiry - 1000)).not.toBeNull();
    expect(verifySession(signed, SECRET, expiry)).toBeNull();
    expect(verifySession(signed, SECRET, expiry + 1000)).toBeNull();
  });
});

describe("verifySession refuses", () => {
  it("a cookie signed with another secret", () => {
    expect(verifySession(token(NOW, OTHER_SECRET), SECRET, NOW)).toBeNull();
    // ...which is also what rotating SESSION_SECRET does: everyone out.
    expect(verifySession(token(), OTHER_SECRET, NOW)).toBeNull();
  });

  it("a tampered payload — the point of signing it", () => {
    const signed = token();
    const [body, signature] = signed.split(".");
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Record<string, unknown>;

    // Become somebody else...
    payload.u = "zezima";
    const forgedBody = Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64url",
    );
    expect(verifySession(`${forgedBody}.${signature}`, SECRET, NOW)).toBeNull();

    // ...or grant yourself a year.
    payload.u = "bob_smith";
    payload.exp = (payload.exp as number) + 365 * 24 * 60 * 60;
    const extended = Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64url",
    );
    expect(verifySession(`${extended}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it("a self-consistent cookie that claims a longer life than the TTL", () => {
    // Signed correctly, so only the iat/exp span catches it. That span is what
    // a leaked secret would otherwise be able to stretch indefinitely.
    const iat = Math.floor(NOW / 1000);
    const forged = {
      v: 1,
      u: "bob_smith",
      sv: SV,
      iat,
      exp: iat + SESSION_TTL_SECONDS + 1,
    };
    expect(verifySession(signSession(forged, SECRET), SECRET, NOW)).toBeNull();
  });

  it("a wrong payload version", () => {
    const iat = Math.floor(NOW / 1000);
    const v2 = {
      v: 2,
      u: "bob_smith",
      sv: SV,
      iat,
      exp: iat + SESSION_TTL_SECONDS,
    };
    expect(verifySession(signSession(v2, SECRET), SECRET, NOW)).toBeNull();
  });

  it("a username or salt fingerprint of the wrong shape", () => {
    const iat = Math.floor(NOW / 1000);
    const base = { v: 1, iat, exp: iat + SESSION_TTL_SECONDS };
    for (const bad of [
      { ...base, u: "Bob Smith", sv: SV }, // not canonical
      { ...base, u: "", sv: SV },
      { ...base, u: "waytoolonganame", sv: SV },
      { ...base, u: "bob_smith", sv: "" },
      { ...base, u: "bob_smith", sv: "not hex here!!!!" },
      { ...base, u: "bob_smith", sv: SV.slice(0, 8) },
    ]) {
      expect(verifySession(signSession(bad, SECRET), SECRET, NOW)).toBeNull();
    }
  });

  it("nothing at all, and anything malformed", () => {
    for (const bad of [null, undefined, "", ".", "a.", ".b", "nodots", "a.b"]) {
      expect(verifySession(bad, SECRET, NOW)).toBeNull();
    }
  });

  it("a valid cookie when the secret is missing — fail closed", () => {
    expect(verifySession(token(), null, NOW)).toBeNull();
    expect(verifySession(token(), undefined, NOW)).toBeNull();
    expect(verifySession(token(), "", NOW)).toBeNull();
  });
});

describe("the cookie itself", () => {
  it("is named, HttpOnly, Lax, path-wide and seven days long", () => {
    expect(SESSION_COOKIE).toBe("zanaris_session");
    expect(sessionCookieOptions(true)).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
  });

  it("drops Secure off https, so localhost can log in", () => {
    expect(sessionCookieOptions(false).secure).toBe(false);
  });

  it("has no Domain, so it is host-only", () => {
    // The absence is the feature: with a Domain the cookie would spread to
    // every subdomain, and www would not need its 308 to the apex.
    expect(sessionCookieOptions(true)).not.toHaveProperty("domain");
  });

  it("clears with Max-Age=0 and otherwise identical attributes", () => {
    // A browser only replaces a cookie when name, path and domain all match,
    // so the cleared form has to be the same cookie with no life left.
    expect(clearedSessionCookieOptions(true)).toEqual({
      ...sessionCookieOptions(true),
      maxAge: 0,
    });
  });
});
