"use client";

import { useEffect, useRef, useState } from "react";

import Script from "next/script";

import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { turnstileSiteKey } from "@/lib/account/site-key";
import { LOGIN_LABELS, submitState } from "@/lib/account/submit";
import { TURNSTILE_LOGIN_ACTION } from "@/lib/account/turnstile";
import { PASSWORD_MAX_TYPED } from "@/lib/account/validation";

import styles from "./Account.module.css";

/**
 * The login box.
 *
 * Deliberately says two things the register form also says, because a player
 * who has forgotten a password arrives *here*, not there: passwords are not
 * case-sensitive, and there is no reset link — a forgotten one needs staff.
 *
 * The username is sent as typed and canonicalised on the server, so `Bob
 * Smith` logs into `bob_smith` exactly as the 2004 client does. Nothing in
 * this component decides anything: every rejection is a code from the route,
 * looked up in `MESSAGES`.
 */

const TURNSTILE_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

const MESSAGES: Record<string, string> = {
  // The one answer a wrong name and a wrong password share, on purpose: the
  // endpoint is not a place to find out which usernames exist.
  bad_credentials: "Wrong username or password.",
  rate_limited: "Too many attempts. Wait 15 minutes.",
  turnstile:
    "The anti-bot check did not pass. Reload the page and try again; if it keeps failing, the check is misconfigured and staff need to know.",
  username_format:
    "A username is 1 to 12 characters: letters, numbers, spaces and underscores.",
  username_unencodable: "That username has no letters or numbers in it.",
  origin: "That request did not come from this site. Reload the page.",
  unavailable: "Login is unavailable right now. Try again shortly.",
  bad_request: "Something went wrong sending that. Try again.",
};

type State =
  | { kind: "editing" }
  | { kind: "submitting" }
  | { kind: "failed"; error: string };

export default function LoginForm() {
  const siteKey = turnstileSiteKey(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
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
      // `login`, not `signup`: the route accepts only a token minted by this
      // widget, so a token solved on the register page mints nothing here.
      action: TURNSTILE_LOGIN_ACTION,
      theme: "dark",
      callback: (value) => setToken(value),
      "expired-callback": () => setToken(null),
      "error-callback": () => setToken(null),
    });
  }, [scriptReady, siteKey]);

  const submit = submitState({
    configured: Boolean(siteKey),
    token,
    submitting: state.kind === "submitting",
    labels: LOGIN_LABELS,
  });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (state.kind === "submitting") return;

    setState({ kind: "submitting" });
    try {
      const response = await fetch("/api/account/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, turnstileToken: token }),
      });

      if (response.ok) {
        // A full document load, not a router push. The cookie was set on this
        // response, and /account has to be rendered by a request that carries
        // it; a client-side navigation would also leave the router cache
        // holding the signed-out render of every page in the chrome. It is
        // what the rest of the site does anyway — see the note in Frame.tsx.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/account");
        return;
      }

      const body: unknown = await response.json().catch(() => null);
      const code = (body as { error?: string } | null)?.error ?? "unavailable";
      setState({
        kind: "failed",
        error: MESSAGES[code] ?? "Login failed. Try again.",
      });
    } catch {
      setState({ kind: "failed", error: MESSAGES.unavailable });
    } finally {
      // Every token is single-use, so a failed attempt needs a fresh one.
      window.turnstile?.reset(widgetIdRef.current);
      setToken(null);
    }
  }

  return (
    <>
      <TitleBox
        title="Login"
        links={[{ href: "/register", text: "Have an invite?" }]}
      />

      <Panel>
        <Script
          src={TURNSTILE_SRC}
          strategy="afterInteractive"
          onLoad={() => setScriptReady(true)}
        />

        <div className={styles.form}>
          <div className={styles.heading}>
            <b>Legacy Login</b>
          </div>

          <form onSubmit={onSubmit}>
            <div className={styles.fields}>
              <label htmlFor="login-username">Username:</label>
              <input
                id="login-username"
                type="text"
                name="username"
                value={username}
                maxLength={12}
                autoComplete="username"
                autoFocus
                required
                onChange={(event) => setUsername(event.target.value)}
              />

              <label htmlFor="login-password">Password:</label>
              <input
                id="login-password"
                type="password"
                name="password"
                value={password}
                maxLength={PASSWORD_MAX_TYPED}
                autoComplete="current-password"
                required
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {siteKey ? (
              <div className={styles.turnstile} ref={widgetRef} />
            ) : (
              <p className={styles.error} role="status">
                Login is closed: the anti-bot check is not configured.
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

          <p className={styles.note}>
            Passwords are not case-sensitive: the 2004 login protocol folds the
            case, so <code>Hunter2</code> and <code>hunter2</code> are the same
            password.
          </p>
          <p className={styles.note}>
            <b>There is no password reset.</b> There is no mail server to send a
            reset link, so a forgotten password can only be changed by staff.
          </p>
          <p className={styles.note}>
            Have an invite?{" "}
            <a className={frame.link} href="/register">
              Claim it
            </a>
            .
          </p>
        </div>
      </Panel>
    </>
  );
}
