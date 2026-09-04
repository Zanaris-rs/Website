import { createHash } from "node:crypto";

/**
 * A stable, non-reversible fingerprint of the signup client.
 *
 * The raw User-Agent is stored nowhere: it is weakly identifying on its own
 * and useless to staff in full. The hash is: identical strings collide, so a
 * farm signing up from one script is visible in a `group by` afterwards, which
 * is the only thing this column is for. It stops nothing at signup.
 */
export function agentHash(userAgent: string | null | undefined): string {
  return createHash("sha256")
    .update(userAgent ?? "")
    .digest("hex");
}
