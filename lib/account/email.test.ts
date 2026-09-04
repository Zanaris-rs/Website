import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkEmail, clearMxCache, hasMx, isDisposable, normalizeEmail } from "./email";

const withMx = async () => [{ exchange: "mx.example.com" }];
const noMx = async () => [];
const failing = (code: string) => async () => {
  const error = new Error(code) as NodeJS.ErrnoException;
  error.code = code;
  throw error;
};

beforeEach(() => {
  clearMxCache();
});

describe("normalizeEmail", () => {
  it("lower-cases", () => {
    expect(normalizeEmail("Bob@Example.COM")?.email).toBe("bob@example.com");
  });

  it("strips a +tag everywhere", () => {
    expect(normalizeEmail("bob+rs@fastmail.com")?.normalized).toBe(
      "bob@fastmail.com",
    );
  });

  it("strips gmail dots, and only gmail dots", () => {
    expect(normalizeEmail("bob.smith+rs@gmail.com")?.normalized).toBe(
      "bobsmith@gmail.com",
    );
    expect(normalizeEmail("bob.smith@googlemail.com")?.normalized).toBe(
      "bobsmith@googlemail.com",
    );
    expect(normalizeEmail("bob.smith@fastmail.com")?.normalized).toBe(
      "bob.smith@fastmail.com",
    );
  });

  it("keeps the address as typed alongside the comparison key", () => {
    const parsed = normalizeEmail("Bob.Smith+rs@Gmail.com");
    expect(parsed).toEqual({
      email: "bob.smith+rs@gmail.com",
      normalized: "bobsmith@gmail.com",
      domain: "gmail.com",
    });
  });

  it("collapses two spellings of one mailbox to one key", () => {
    expect(normalizeEmail("B.O.B+a@gmail.com")?.normalized).toBe(
      normalizeEmail("bob@gmail.com")?.normalized,
    );
  });

  it("rejects what is not an address", () => {
    for (const bad of ["", "bob", "bob@", "@example.com", "bob@example", "a b@c.com", "+tag@x.com"]) {
      expect(normalizeEmail(bad)).toBeNull();
    }
  });
});

describe("isDisposable", () => {
  it("knows the vendored blocklist", () => {
    expect(isDisposable("mailinator.com")).toBe(true);
    expect(isDisposable("gmail.com")).toBe(false);
  });
});

describe("hasMx", () => {
  it("accepts a domain with MX records", async () => {
    expect(await hasMx("example.com", withMx)).toBe(true);
  });

  it("rejects an empty MX set", async () => {
    expect(await hasMx("example.com", noMx)).toBe(false);
  });

  it("rejects NXDOMAIN and ENODATA, which are real answers", async () => {
    expect(await hasMx("nope.example", failing("ENOTFOUND"))).toBe(false);
    clearMxCache();
    expect(await hasMx("nope.example", failing("ENODATA"))).toBe(false);
  });

  it("fails OPEN on resolver trouble", async () => {
    // One flaky resolver must not read as "nobody can sign up".
    expect(await hasMx("example.com", failing("ESERVFAIL"))).toBe(true);
    clearMxCache();
    expect(await hasMx("example.com", failing("ETIMEOUT"))).toBe(true);
    clearMxCache();
    expect(await hasMx("example.com", failing("EAI_AGAIN"))).toBe(true);
  });

  it("caches for an hour", async () => {
    const resolve = vi.fn(withMx);
    const start = 1_000_000;
    expect(await hasMx("example.com", resolve, start)).toBe(true);
    expect(await hasMx("example.com", resolve, start + 59 * 60_000)).toBe(true);
    expect(resolve).toHaveBeenCalledTimes(1);

    expect(await hasMx("example.com", resolve, start + 61 * 60_000)).toBe(true);
    expect(resolve).toHaveBeenCalledTimes(2);
  });
});

describe("checkEmail", () => {
  it("runs format, then blocklist, then MX", async () => {
    expect(await checkEmail("nope", withMx)).toEqual({
      ok: false,
      error: "email_format",
    });
    expect(await checkEmail("bob@mailinator.com", withMx)).toEqual({
      ok: false,
      error: "email_disposable",
    });
    expect(await checkEmail("bob@example.com", noMx)).toEqual({
      ok: false,
      error: "email_no_mx",
    });
  });

  it("returns both forms of a good address", async () => {
    expect(await checkEmail("Bob.Smith+rs@gmail.com", withMx)).toEqual({
      ok: true,
      value: {
        email: "bob.smith+rs@gmail.com",
        normalized: "bobsmith@gmail.com",
        domain: "gmail.com",
      },
    });
  });
});
