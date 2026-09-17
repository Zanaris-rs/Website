"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import account from "@/components/account/Account.module.css";
import { PASSWORD_MAX_TYPED } from "@/lib/account/validation";
import { toDisplayName } from "@/lib/base37";

/**
 * Switch one account's inviting on or off, with your password. Off also
 * cancels every unused link that account holds; the form says so before it is
 * pressed, not after.
 */

const MESSAGES: Record<string, string> = {
  bad_credentials: "That is not your password.",
  forbidden: "Your account is not staff.",
  not_found: "There is no account with that name.",
  invalid: "Something went wrong sending that. Reload the page.",
  rate_limited: "Too many wrong passwords. Wait, then try again.",
  session_expired: "You are signed out. Log in again.",
  origin: "That request did not come from this site. Reload the page.",
  unavailable: "The staff tools are unavailable right now. Try again shortly.",
  bad_request: "Something went wrong sending that. Try again.",
};

type State =
  | { kind: "editing" }
  | { kind: "submitting" }
  | { kind: "failed"; error: string };

export default function StaffInviteToggle({
  username,
  enabled,
  banned,
}: {
  username: string;
  enabled: boolean;
  banned: boolean;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [state, setState] = useState<State>({ kind: "editing" });
  const next = !enabled;
  const name = toDisplayName(username);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (state.kind === "submitting") return;

    setState({ kind: "submitting" });
    try {
      const response = await fetch(
        `/api/staff/invites/${encodeURIComponent(username)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled: next, password }),
        },
      );
      setPassword("");

      if (response.ok) {
        setState({ kind: "editing" });
        router.refresh();
        return;
      }

      const payload: unknown = await response.json().catch(() => null);
      const code = (payload as { error?: string } | null)?.error ?? "unavailable";
      setState({
        kind: "failed",
        error: MESSAGES[code] ?? "That did not work. Try again.",
      });
    } catch {
      setPassword("");
      setState({ kind: "failed", error: MESSAGES.unavailable });
    }
  }

  return (
    <form onSubmit={onSubmit} className={account.form}>
      <p>
        Inviting is <b>{enabled ? "on" : "off"}</b> for {name}.{" "}
        {next
          ? "Switching it on lets them make as many single-use links as they like, twenty unused at a time."
          : "Switching it off cancels every unused link they hold, straight away."}
      </p>

      {banned ? (
        <p className={account.note}>
          {name} is banned: any links they make stay dead until the ban ends,
          and lifting the ban does not switch inviting back on.
        </p>
      ) : null}

      <div className={account.fields}>
        <label htmlFor="invites-password">Your password:</label>
        <input
          id="invites-password"
          type="password"
          value={password}
          maxLength={PASSWORD_MAX_TYPED}
          autoComplete="current-password"
          required
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      {state.kind === "failed" && (
        <p className={account.error} role="alert">
          {state.error}
        </p>
      )}

      <div className={account.actions}>
        <button
          className={account.submit}
          type="submit"
          disabled={state.kind === "submitting" || password.length === 0}
        >
          {state.kind === "submitting"
            ? "Saving..."
            : next
              ? `Let ${name} invite`
              : `Stop ${name} inviting`}
        </button>
      </div>
    </form>
  );
}
