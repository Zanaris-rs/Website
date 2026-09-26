/**
 * The browser's side of the Adventurer Log's write routes: one request, and the
 * sentence to show when it is refused. A refusal whose error is already a
 * sentence (the routes' own text checks) is shown as it is.
 */

const MESSAGES: Record<string, string> = {
  banned: "Your account is banned.",
  muted: "You are muted, so you cannot post or change your public text.",
  blocked: "The owner of this log has blocked you from replying.",
  not_found: "That is not there any more.",
  css_disabled: "Staff have turned off your log's stylesheet.",
  rate_limited: "That is a lot at once. Try again later.",
  already: "You have already reported that.",
  self: "That is yours.",
  no_such_player: "There is no player by that name.",
  session_expired: "You have been signed out. Log in again.",
  origin: "That request came from another site, so it was refused.",
  unavailable: "The Adventurer Log is unavailable right now. Try again in a moment.",
  bad_request: "That request was not understood.",
};

/**
 * What a gz's refusals mean, where the shared sentence is about something
 * else (a block is about replying, "self" about reporting or blocking).
 */
export const GZ_MESSAGES: Readonly<Record<string, string>> = {
  self: "You cannot gz your own adventures.",
  blocked: "The owner of this log has blocked you, so you cannot gz their adventures.",
  not_found: "That adventure is not there any more.",
  rate_limited: "That is a lot of gz at once. Try again in a while.",
};

/**
 * `messages` puts a request's own sentences before the shared ones. A refusal
 * also carries its `code` (the route's `error`), for a form that marks the
 * field it was about.
 */
export async function send(
  url: string,
  body: unknown,
  method: "POST" | "PUT" | "PATCH" | "DELETE" = "POST",
  messages: Readonly<Record<string, string>> = {},
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; message: string; code: string }> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    return { ok: false, message: MESSAGES.unavailable, code: "unavailable" };
  }

  const data = ((await response.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  if (response.ok) return { ok: true, data };

  const code = typeof data.error === "string" ? data.error : "unavailable";
  return {
    ok: false,
    message: messages[code] ?? MESSAGES[code] ?? (code.includes(" ") ? code : MESSAGES.unavailable),
    code,
  };
}
