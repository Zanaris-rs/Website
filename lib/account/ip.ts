/**
 * The client address, and the subnet the rate limiter counts against.
 *
 * A /24-only rule is free to bypass over IPv6, where a single residential
 * customer is typically handed a whole /64 and can mint a new address per
 * request. So v4 groups by /24 and v6 by /64: one household is one group on
 * either protocol.
 */

/** `::ffff:1.2.3.4` is an IPv4 address wearing a v6 hat. */
export function normalizeIp(raw: string): string {
  const ip = raw.trim().toLowerCase();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  return mapped ? mapped[1] : ip;
}

function isIpv4(ip: string): boolean {
  const parts = ip.split(".");
  return (
    parts.length === 4 &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  );
}

/**
 * The subnet a rate-limit count is keyed on: `1.2.3.0/24` or `2001:db8::/64`.
 *
 * Anything unparseable is returned as-is, so a strange proxy header still
 * groups with itself instead of silently collapsing every request into one
 * bucket (or worse, into no bucket at all).
 */
export function ipGroup(raw: string): string {
  const ip = normalizeIp(raw);

  if (isIpv4(ip)) {
    const [a, b, c] = ip.split(".");
    return `${a}.${b}.${c}.0/24`;
  }

  if (ip.includes(":")) {
    const expanded = expandIpv6(ip);
    if (expanded) return `${expanded.slice(0, 4).join(":")}::/64`;
  }

  return ip;
}

/** Expand `2001:db8::1` into its eight groups; `null` if it is not an address. */
function expandIpv6(ip: string): string[] | null {
  const withoutZone = ip.split("%")[0];
  const halves = withoutZone.split("::");
  if (halves.length > 2) return null;

  const head = halves[0] === "" ? [] : halves[0].split(":");
  const tail = halves.length === 2 && halves[1] !== "" ? halves[1].split(":") : [];
  const groups =
    halves.length === 2
      ? [...head, ...Array(8 - head.length - tail.length).fill("0"), ...tail]
      : head;

  if (groups.length !== 8) return null;
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return null;

  return groups.map((group) => group.padStart(4, "0"));
}

/** Anything that can answer `get`, i.e. `Headers` or a plain map. */
type HeaderSource = { get(name: string): string | null };

/**
 * The caller's address as Vercel reports it.
 *
 * `x-forwarded-for` is a list; the *first* entry is the client, everything
 * after it is a proxy. On Vercel the header is set by the platform, so it can
 * be trusted — behind any other proxy it cannot, which is why this is the only
 * place that reads it.
 */
export function clientIp(headers: HeaderSource): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return normalizeIp(first);
  }

  const real = headers.get("x-real-ip");
  return real ? normalizeIp(real.trim()) : null;
}
