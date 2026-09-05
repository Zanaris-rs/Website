/**
 * The public half of the Cloudflare Turnstile widget.
 *
 * A Turnstile **site key is public by construction**: it is rendered into the
 * HTML of every page that carries the widget, so anyone who can load
 * `/register` already has it. Hard-coding it here leaks nothing. The secret
 * key is the half that matters, it lives only in `TURNSTILE_SECRET_KEY`, and
 * nothing in this repo ever holds a copy of it.
 *
 * So the site key gets a default and the secret does not. That asymmetry is
 * deliberate:
 *
 * - a missing **site** key used to mean the form rendered no widget at all and
 *   disabled its own submit button — a blank page for everyone because one
 *   `NEXT_PUBLIC_*` variable was missing from one Vercel project, when the
 *   value it was missing is a public constant we can simply ship;
 * - a missing **secret** key still means every registration is rejected. That
 *   one has to fail closed, because guessing it wrong is what turns a gate
 *   into the shape of a gate.
 *
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` still overrides, which is what a second
 * widget (a staging one, a rotated one) needs.
 */

/** The live Zanaris widget. Public; see the note above. */
export const DEFAULT_TURNSTILE_SITE_KEY = "0x4AAAAAAEoMC04y54IPJd-n";

/**
 * The site key the form should render with.
 *
 * Whitespace-only counts as unset: a Vercel variable that was added and left
 * empty should behave like one that was never added, not like a site key made
 * of spaces, which Turnstile answers with an unrenderable widget.
 */
export function turnstileSiteKey(configured: string | null | undefined): string {
  const trimmed = (configured ?? "").trim();
  return trimmed === "" ? DEFAULT_TURNSTILE_SITE_KEY : trimmed;
}
