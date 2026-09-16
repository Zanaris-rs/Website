"use client";

import { useEffect, useRef, useState } from "react";

import Script from "next/script";

import { toDisplayName, toSafeName } from "@/lib/base37";
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  validateUsername,
} from "@/lib/account/validation";
import { turnstileSiteKey } from "@/lib/account/site-key";
import { TURNSTILE_ACTION } from "@/lib/account/turnstile";
import { submitState } from "@/lib/account/submit";
import { formatInviteCode } from "@/lib/invite/code";
import { formatCitizen } from "@/lib/invite/format";

import frame from "@/components/site/Frame.module.css";

import styles from "./RegisterForm.module.css";

/**
 * The register form.
 *
 * Four things it says out loud, because each one is a support ticket
 * otherwise:
 *
 * 1. **the name you will actually get**, live, before submitting — base37
 *    folds case and drops trailing underscores, so `Bob_` becomes `bob`;
 * 2. **passwords are case-insensitive** — a protocol constraint, not a choice,
 *    and a player who sets `Hunter2` and later types `hunter2` should not be
 *    surprised when it works (or worse, assume it should not);
 * 3. **there is no password reset** — with no mailer there is no link to send,
 *    so a forgotten password needs staff. That belongs on the form, not in a
 *    FAQ nobody reads.
 * 4. **who let you in** — the form only exists behind an invite link, and it
 *    says whose.
 */

const TURNSTILE_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
  interface Window {
    turnstile?: {
      render(
        element: HTMLElement,
        options: {
          sitekey: string;
          action?: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ): string | undefined;
      reset(widgetId?: string): void;
    };
  }
}

const MESSAGES: Record<string, string> = {
  turnstile:
    "The anti-bot check did not pass. Reload the page and try again; if it keeps failing, the check is misconfigured and staff need to know.",
  username_format:
    "A username is 1 to 12 characters: letters, numbers, spaces and underscores.",
  username_unencodable: "That username has no letters or numbers in it.",
  username_reserved: "That username is reserved.",
  password_short: `A password must be at least ${PASSWORD_MIN} characters.`,
  password_long: `A password can be at most ${PASSWORD_MAX} characters.`,
  password_charset:
    "A password can only use characters you can type on the login screen.",
  email_format: "That does not look like an email address.",
  email_disposable: "Disposable email addresses are not accepted.",
  email_no_mx: "That domain cannot receive email.",
  username_taken: "That name is taken. Try another.",
  invite_invalid: "That invite code is not a real one. Go back to the link you were sent.",
  invite_claimed:
    "Somebody has just used this invite. Each link lets one person in — ask for another.",
  invite_expired: "This invite expired while you were filling in the form. Ask for a new one.",
  invite_revoked: "This invite has been cancelled. Ask whoever sent it for a new one.",
  rate_limited:
    "Too many accounts have been created, or too many invite codes tried, from your connection recently. Try again later.",
  unavailable: "Registration is unavailable right now. Try again shortly.",
  bad_request: "Something went wrong sending that. Try again.",
};

type State =
  | { kind: "editing" }
  | { kind: "submitting" }
  | { kind: "failed"; error: string }
  | { kind: "done"; username: string; citizenNumber: number | null };

export default function RegisterForm({ invite }: { invite: { code: string; inviter: string } }) {
  // Site keys are public, so this one has a shipped default and the form
  // renders a widget even where `NEXT_PUBLIC_TURNSTILE_SITE_KEY` was never
  // set. See lib/account/site-key.ts.
  const siteKey = turnstileSiteKey(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [state, setState] = useState<State>({ kind: "editing" });
  const [scriptReady, setScriptReady] = useState(false);

  const widgetRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);
  const widgetIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!scriptReady || !siteKey || renderedRef.current) return;
    const element = widgetRef.current;
    if (!element || !window.turnstile) return;

    renderedRef.current = true;
    widgetIdRef.current = window.turnstile.render(element, {
      sitekey: siteKey,
      // The server accepts a token only if it carries this action, so a token
      // minted by any other widget - ours or a copy of our public site key on
      // somebody else's page - is refused. See lib/account/turnstile.ts.
      action: TURNSTILE_ACTION,
      theme: "dark",
      callback: (value) => setToken(value),
      // A token is single-use and short-lived. Dropping it on expiry means the
      // form asks again rather than posting something the server will reject.
      "expired-callback": () => setToken(null),
      "error-callback": () => setToken(null),
    });
  }, [scriptReady, siteKey]);

  const canonical = validateUsername(username);
  const preview = canonical.ok ? canonical.value : toSafeName(username);

  // No token, no submit. Posting without one is a certain 400 `turnstile`,
  // which reads as "the check is broken" when the widget had only not
  // finished yet - or had finished and expired, since both the expired and
  // error callbacks put the token back to null.
  const submit = submitState({
    configured: Boolean(siteKey),
    token,
    submitting: state.kind === "submitting",
  });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (state.kind === "submitting") return;

    if (password !== confirm) {
      setState({ kind: "failed", error: "The passwords do not match." });
      return;
    }

    setState({ kind: "submitting" });
    try {
      const response = await fetch("/api/account/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteCode: invite.code,
          username,
          email,
          password,
          turnstileToken: token,
        }),
      });
      const body: unknown = await response.json().catch(() => null);

      if (response.ok) {
        const created = body as { username?: string; citizenNumber?: number } | null;
        setState({
          kind: "done",
          username: created?.username ?? preview,
          citizenNumber:
            typeof created?.citizenNumber === "number" ? created.citizenNumber : null,
        });
        return;
      }

      const code = (body as { error?: string } | null)?.error ?? "unavailable";
      setState({
        kind: "failed",
        error: MESSAGES[code] ?? "Registration failed. Try again.",
      });
    } catch {
      setState({ kind: "failed", error: MESSAGES.unavailable });
    } finally {
      // Every token is single-use, so a failed attempt needs a fresh one, and
      // a successful one must not leave a spent token sitting in state.
      window.turnstile?.reset(widgetIdRef.current);
      setToken(null);
    }
  }

  if (state.kind === "done") {
    return (
      <div className={`${frame.panel} ${styles.wrap}`}>
        <div className={styles.heading}>
          <b>Welcome to Zanaris</b>
        </div>
        <p className={styles.success}>
          You are <span className={styles.previewName}>{state.username}</span>
          {state.citizenNumber !== null ? (
            <>
              , citizen{" "}
              <span className={styles.previewName}>
                {formatCitizen(state.citizenNumber)}
              </span>
            </>
          ) : null}
          . Log in with that name and the password you just chose.
        </p>
        <p className={styles.success}>
          <a className={frame.link} href="/account/login">
            Log in to your account centre
          </a>
        </p>
        <p className={styles.success}>
          <a className={frame.link} href="/serverlist">
            Choose a world and play
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className={`${frame.panel} ${styles.wrap}`}>
      <Script
        src={TURNSTILE_SRC}
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />

      <div className={styles.heading}>
        <b>
          <span className={styles.previewName}>{toDisplayName(invite.inviter)}</span>{" "}
          invited you to Zanaris
        </b>
        <br />
        <span className={styles.note}>Invite {formatInviteCode(invite.code)}</span>
        <br />
        <a className={frame.link} href="/title">
          Main menu
        </a>
      </div>

      <form onSubmit={onSubmit}>
        <label className={styles.field}>
          <span>Username</span>
          <input
            type="text"
            name="username"
            value={username}
            maxLength={12}
            autoComplete="username"
            required
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>

        <div className={styles.preview} aria-live="polite">
          {username.trim() === "" ? null : canonical.ok ? (
            <>
              You will be{" "}
              <span className={styles.previewName}>{canonical.value}</span>
            </>
          ) : (
            <span className={styles.error}>
              {MESSAGES[canonical.error] ?? "That username will not work."}
            </span>
          )}
        </div>
        <p className={styles.note}>
          Names are stored in lower case with spaces as underscores, and
          trailing underscores are dropped.
        </p>

        <label className={styles.field}>
          <span>Email</span>
          <input
            type="email"
            name="email"
            value={email}
            autoComplete="email"
            required
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <p className={styles.note}>
          Never verified and never emailed — it is only a contact address for
          staff.
        </p>

        <label className={styles.field}>
          <span>Password</span>
          <input
            type="password"
            name="password"
            value={password}
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
            autoComplete="new-password"
            required
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Repeat password</span>
          <input
            type="password"
            name="confirm"
            value={confirm}
            minLength={PASSWORD_MIN}
            maxLength={PASSWORD_MAX}
            autoComplete="new-password"
            required
            onChange={(event) => setConfirm(event.target.value)}
          />
        </label>

        <ul className={styles.warnings}>
          <li>
            <b>This invite works once.</b> Creating the account uses it up.
          </li>
          <li>
            <b>Passwords are not case-sensitive.</b> The 2004 login protocol
            folds the case, so <code>Hunter2</code> and <code>hunter2</code> are
            the same password.
          </li>
          <li>
            <b>There is no password reset.</b> There is no mail server to send a
            reset link, so a forgotten password can only be changed by staff.
            Write it down.
          </li>
          <li>
            {PASSWORD_MIN} to {PASSWORD_MAX} characters, and only characters the
            login screen can type.
          </li>
        </ul>

        {siteKey ? (
          <div className={styles.turnstile} ref={widgetRef} />
        ) : (
          <p className={styles.error} role="status">
            Registration is closed: the anti-bot check is not configured.
          </p>
        )}

        {state.kind === "failed" && (
          <p className={styles.error} role="alert">
            {state.error}
          </p>
        )}

        <div className={styles.actions}>
          <button
            className={styles.submit}
            type="submit"
            disabled={submit.disabled}
          >
            {submit.label}
          </button>
        </div>
      </form>
    </div>
  );
}
