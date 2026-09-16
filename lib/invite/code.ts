/**
 * Invite codes: eighty random bits as sixteen Crockford base32 characters.
 *
 * Crockford because a code gets read aloud and typed from a screenshot: no I,
 * L, O or U, and a typed I, L or O is read as the digit it looks like. Stored
 * ungrouped and upper-case, shown in four groups of four.
 *
 * The engine's `src/util/InviteCode.ts` is the same contract with the same test
 * vectors, and the CHECK constraint in migration 6 is what both answer to.
 *
 * No Node imports here, so the form components can use the parsing and
 * formatting; the random bytes come from `code-server.ts`.
 */

export const INVITE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const INVITE_CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{16}$/;

export const INVITE_BYTES = 10;

export function encodeInviteCode(bytes: Uint8Array): string {
  if (bytes.length !== INVITE_BYTES) {
    throw new Error(
      `an invite code is ${INVITE_BYTES} random bytes, not ${bytes.length}`,
    );
  }

  let code = "";
  let buffered = 0;
  let bits = 0;

  for (const byte of bytes) {
    buffered = (buffered << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      code += INVITE_ALPHABET[(buffered >>> (bits - 5)) & 31];
      bits -= 5;
    }

    // Only the bits not yet written stay, so the buffer never outgrows 32.
    buffered &= (1 << bits) - 1;
  }

  return code;
}

/** Upper-case, drop spaces and dashes, read I and L as 1 and O as 0. */
export function normalizeInviteCode(raw: string): string | null {
  const code = raw
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");
  return INVITE_CODE_PATTERN.test(code) ? code : null;
}

export function formatInviteCode(code: string): string {
  return (code.match(/.{1,4}/g) ?? []).join("-");
}
