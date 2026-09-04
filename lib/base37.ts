/**
 * Base37 name encoding, ported from the engine's `src/util/JString.ts`.
 *
 * The game packs a username into a single 64-bit integer, so a name is only
 * ever 12 characters of `[a-z0-9_]`. Everything else — spaces, punctuation,
 * case, trailing underscores — is lost on the round trip. The site has to
 * agree with the engine exactly: `toSafeName` is what decides which username a
 * player actually gets, and the register form promises it before submitting.
 *
 * `lib/base37.test.ts` pins the port against fixtures taken from the engine.
 */

/** Pack a name into its base37 integer. Non-alphanumerics count as a gap. */
export function toBase37(value: string): bigint {
  const trimmed = value.trim();
  let packed = 0n;

  for (let i = 0; i < trimmed.length && i < 12; i++) {
    const c = trimmed.charCodeAt(i);
    packed *= 37n;

    if (c >= 0x41 && c <= 0x5a) {
      // A-Z
      packed += BigInt(c + 1 - 0x41);
    } else if (c >= 0x61 && c <= 0x7a) {
      // a-z
      packed += BigInt(c + 1 - 0x61);
    } else if (c >= 0x30 && c <= 0x39) {
      // 0-9
      packed += BigInt(c + 27 - 0x30);
    }
  }

  // Trailing gaps (including trailing underscores) are not representable.
  while (packed % 37n === 0n && packed !== 0n) {
    packed /= 37n;
  }

  return packed;
}

// prettier-ignore
const BASE37_LOOKUP: readonly string[] = [
  "_", "a", "b", "c", "d", "e", "f", "g", "h", "i",
  "j", "k", "l", "m", "n", "o", "p", "q", "r", "s",
  "t", "u", "v", "w", "x", "y", "z",
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
];

/** The sentinel the engine returns for a name that cannot be encoded. */
export const INVALID_NAME = "invalid_name";

/** Unpack a base37 integer back into a name. */
export function fromBase37(value: bigint): string {
  // >= 37 to the 12th power
  if (value < 0n || value >= 6582952005840035281n) {
    return INVALID_NAME;
  }

  if (value % 37n === 0n) {
    return INVALID_NAME;
  }

  let length = 0;
  const chars: string[] = Array(12);
  let remaining = value;
  while (remaining !== 0n) {
    const before = remaining;
    remaining /= 37n;
    chars[11 - length++] = BASE37_LOOKUP[Number(before - remaining * 37n)];
  }

  return chars.slice(12 - length).join("");
}

/** The canonical stored form of a username: `Bob Smith` -> `bob_smith`. */
export function toSafeName(name: string): string {
  return fromBase37(toBase37(name));
}

/** Title-case each word: `the inducted` -> `The Inducted`. */
export function toTitleCase(value: string): string {
  return value.replace(
    /\w\S*/g,
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
  );
}

/** How a username is shown to players: `the_inducted` -> `The Inducted`. */
export function toDisplayName(name: string): string {
  return toTitleCase(toSafeName(name).replaceAll("_", " "));
}
