import { INVALID_NAME, toSafeName } from "@/lib/base37";

/**
 * The log's name from a `[username]` URL segment, in its stored form
 * (`Lynx%20Titan` -> `lynx_titan`), or null when there is none to look up:
 * an escape that does not decode, or a name base37 cannot hold. The page,
 * its link preview and the timeline API all read a log's name this way, so
 * one URL never means two different logs.
 */
export function nameFrom(raw: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const safe = toSafeName(decoded);
  return safe === INVALID_NAME ? null : safe;
}
