"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import account from "@/components/account/Account.module.css";
import frame from "@/components/site/Frame.module.css";
import { joinPath } from "@/lib/invite/format";
import type { InviteView } from "@/lib/invite/view";

/**
 * The list, the Create button, and a Copy and a Cancel per unused link. After
 * any change the server page is re-read with `router.refresh()` rather than
 * patched in place, so what is shown is always what the database says.
 */

const MESSAGES: Record<string, string> = {
  disabled: "Inviting isn't enabled for your account.",
  too_many: "You already have twenty unused links (or made a hundred today). Use or cancel some first.",
  not_found: "That link no longer works, so there is nothing to cancel.",
  already_claimed: "Somebody has already used that link.",
  session_expired: "You are signed out. Log in again.",
  origin: "That request did not come from this site. Reload the page.",
  unavailable: "Invite links are unavailable right now. Try again shortly.",
};

type Busy = { kind: "idle" } | { kind: "working" } | { kind: "failed"; error: string };

async function errorOf(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  const code = (body as { error?: string } | null)?.error ?? "unavailable";
  return MESSAGES[code] ?? MESSAGES.unavailable;
}

export default function InviteList({
  enabled,
  invites,
}: {
  enabled: boolean;
  invites: readonly InviteView[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Busy>({ kind: "idle" });
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function urlFor(path: string): string {
    return `${window.location.origin}${path}`;
  }

  async function create() {
    if (busy.kind === "working") return;
    setBusy({ kind: "working" });
    try {
      const response = await fetch("/api/account/invites", { method: "POST" });
      if (!response.ok) {
        setBusy({ kind: "failed", error: await errorOf(response) });
        return;
      }
      const body = (await response.json()) as { code?: string };
      setFresh(body.code ? urlFor(joinPath(body.code)) : null);
      setBusy({ kind: "idle" });
      router.refresh();
    } catch {
      setBusy({ kind: "failed", error: MESSAGES.unavailable });
    }
  }

  async function cancel(code: string) {
    if (busy.kind === "working") return;
    setBusy({ kind: "working" });
    try {
      const response = await fetch(
        `/api/account/invites/${encodeURIComponent(code)}/revoke`,
        { method: "POST" },
      );
      if (!response.ok) {
        setBusy({ kind: "failed", error: await errorOf(response) });
        return;
      }
      setBusy({ kind: "idle" });
      router.refresh();
    } catch {
      setBusy({ kind: "failed", error: MESSAGES.unavailable });
    }
  }

  async function copy(path: string) {
    const url = urlFor(path);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(path);
    } catch {
      // No clipboard permission: the link is on screen to copy by hand.
      setCopied(null);
    }
  }

  return (
    <>
      {enabled ? (
        <div className={account.actions}>
          <button
            className={account.submit}
            type="button"
            onClick={create}
            disabled={busy.kind === "working"}
          >
            {busy.kind === "working" ? "Working..." : "Create an invite link"}
          </button>
        </div>
      ) : null}

      {fresh ? (
        <p className={account.success} role="status">
          New link: <code>{fresh}</code>
        </p>
      ) : null}

      {busy.kind === "failed" ? (
        <p className={account.error} role="alert">
          {busy.error}
        </p>
      ) : null}

      {invites.length === 0 ? (
        <p className={account.note}>You have not made any links yet.</p>
      ) : (
        <div className={account.scroller}>
          <table className={account.logins}>
            <thead>
              <tr>
                <th>Link</th>
                <th>Status</th>
                <th>Made</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => (
                <tr key={invite.code}>
                  <td>
                    <code>{invite.display}</code>
                  </td>
                  <td>
                    {invite.label}
                    <br />
                    <span className={account.note}>{invite.detail}</span>
                  </td>
                  <td>{invite.created}</td>
                  <td>
                    {invite.shareable && enabled ? (
                      <>
                        <button
                          type="button"
                          className={frame.link}
                          onClick={() => copy(invite.path)}
                        >
                          {copied === invite.path ? "Copied" : "Copy link"}
                        </button>{" "}
                        <button
                          type="button"
                          className={frame.link}
                          onClick={() => cancel(invite.code)}
                          disabled={busy.kind === "working"}
                        >
                          Cancel
                        </button>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
