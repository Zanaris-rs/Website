/**
 * What a form's submit button says and whether it can be pressed.
 *
 * Split out of the components because the components themselves are not
 * testable in this repo — vitest runs in a node environment over `lib/**` and
 * there is no DOM renderer here — while the rule this encodes is exactly the
 * sort of thing that regresses silently.
 *
 * The rule: **no submit without a Turnstile token.** Posting without one is a
 * guaranteed 400 `turnstile` from the route, which reads to the player as "the
 * anti-bot check is broken" when in fact the widget had simply not finished,
 * or its token had expired and been dropped. A disabled button that says what
 * it is waiting for is the honest version of the same second.
 *
 * The genuinely-misconfigured cases still speak for themselves elsewhere: with
 * no site key the form says registration is closed, and a `success: false`
 * from Cloudflare comes back as the 400 the form shows in full.
 */

export type SubmitState = {
  readonly disabled: boolean;
  readonly label: string;
};

/** What a given form calls its action, idle and in flight. */
export type SubmitLabels = {
  readonly idle: string;
  readonly busy: string;
};

export const REGISTER_LABELS: SubmitLabels = {
  idle: "Create account",
  busy: "Creating...",
};

export const LOGIN_LABELS: SubmitLabels = {
  idle: "Login",
  busy: "Logging in...",
};

export type SubmitInput = {
  /** Is `NEXT_PUBLIC_TURNSTILE_SITE_KEY` set? Without it there is no widget. */
  readonly configured: boolean;
  /** The current Turnstile token; `null` before one arrives and after it expires. */
  readonly token: string | null;
  /** Is a submission in flight? */
  readonly submitting: boolean;
  /** Defaults to the register wording, which is where this started. */
  readonly labels?: SubmitLabels;
};

const WAITING = "Waiting for the anti-bot check…";

export function submitState(input: SubmitInput): SubmitState {
  const labels = input.labels ?? REGISTER_LABELS;

  if (input.submitting) {
    return { disabled: true, label: labels.busy };
  }

  // Unconfigured is its own message, right above the button. Saying "waiting"
  // here would promise something that is never going to arrive.
  if (!input.configured) {
    return { disabled: true, label: labels.idle };
  }

  if (input.token === null) {
    return { disabled: true, label: WAITING };
  }

  return { disabled: false, label: labels.idle };
}
