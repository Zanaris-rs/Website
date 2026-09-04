import { promises as dns } from "node:dns";

import disposableDomains from "./disposable-domains.json";

/**
 * Email checks for registration.
 *
 * The email is **metadata, not identity**: nothing here proves the player owns
 * the address, because there is no mailer and no verification link. What these
 * checks buy is a contact address that is probably real and a way for staff to
 * see lazy multi-accounting afterwards. Treat them as hygiene, not a gate.
 *
 * `disposable-domains.json` is the `disposable-email-domains` blocklist
 * (github.com/disposable-email-domains/disposable-email-domains), released
 * under CC0-1.0, sorted and de-duplicated.
 */

/** Deliberately loose: a real address is proven by delivery, and we never send. */
const EMAIL_PATTERN = /^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/;

const DISPOSABLE: ReadonlySet<string> = new Set(disposableDomains);

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

export type EmailError =
  | "email_format"
  | "email_disposable"
  | "email_no_mx";

export type NormalizedEmail = {
  /** As typed, only lower-cased: what is stored and shown back to the player. */
  readonly email: string;
  /** The de-duplication key: `+tag` gone, gmail dots gone. */
  readonly normalized: string;
  readonly domain: string;
};

/**
 * Fold the address to a comparison key.
 *
 * `Bob.Smith+rs@Gmail.com` and `bobsmith@gmail.com` are the same mailbox, so
 * they must be the same key or the email column tells staff nothing. Only
 * gmail is guaranteed to ignore dots, so the dot rule is gmail-only; `+tag` is
 * near-universal and applied everywhere.
 */
export function normalizeEmail(raw: string): NormalizedEmail | null {
  const email = raw.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return null;

  const at = email.lastIndexOf("@");
  let local = email.slice(0, at);
  const domain = email.slice(at + 1);

  const plus = local.indexOf("+");
  if (plus !== -1) local = local.slice(0, plus);

  if (GMAIL_DOMAINS.has(domain)) local = local.replaceAll(".", "");

  // Stripping can empty the local part ("+tag@x.com"); that is not an address.
  if (local === "") return null;

  return { email, normalized: `${local}@${domain}`, domain };
}

export function isDisposable(domain: string): boolean {
  return DISPOSABLE.has(domain);
}

/** One hour, matching the plan; long enough that a burst costs one lookup. */
const MX_TTL_MS = 60 * 60 * 1000;

type MxEntry = { hasMx: boolean; expires: number };

const mxCache = new Map<string, MxEntry>();

/** Test seam, and a way to drop the cache if a domain's DNS is fixed. */
export function clearMxCache(): void {
  mxCache.clear();
}

export type MxLookup = (domain: string) => Promise<{ exchange: string }[]>;

/**
 * Does the domain accept mail?
 *
 * **Fails open on resolver trouble, and only on resolver trouble.** NXDOMAIN
 * or an empty MX set is a real answer — the domain cannot receive mail, so
 * reject. SERVFAIL, a timeout or anything else is the resolver having a bad
 * day, and treating that as a rejection would take registration down globally
 * while looking exactly like "nobody can sign up".
 */
export async function hasMx(
  domain: string,
  resolve: MxLookup = (name) => dns.resolveMx(name),
  now: number = Date.now(),
): Promise<boolean> {
  const cached = mxCache.get(domain);
  if (cached && cached.expires > now) return cached.hasMx;

  let hasMxRecord: boolean;
  try {
    const records = await resolve(domain);
    hasMxRecord = records.length > 0;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    // A definite "no such name" / "no such record" is an answer; keep it.
    hasMxRecord = code !== "ENOTFOUND" && code !== "ENODATA";
  }

  mxCache.set(domain, { hasMx: hasMxRecord, expires: now + MX_TTL_MS });
  return hasMxRecord;
}

/** The whole email check, in the order the route runs it. */
export async function checkEmail(
  raw: string,
  resolve?: MxLookup,
): Promise<
  | { ok: true; value: NormalizedEmail }
  | { ok: false; error: EmailError }
> {
  const parsed = normalizeEmail(raw);
  if (!parsed) return { ok: false, error: "email_format" };
  if (isDisposable(parsed.domain)) {
    return { ok: false, error: "email_disposable" };
  }
  if (!(await hasMx(parsed.domain, resolve))) {
    return { ok: false, error: "email_no_mx" };
  }
  return { ok: true, value: parsed };
}
