"use client";

import { useState } from "react";

import styles from "./Account.module.css";

/**
 * Log out.
 *
 * A button that POSTs, not a link: a GET that signs you out is a logout CSRF —
 * an `<img src="/api/account/logout">` on any page the reader visits would do
 * it. The route checks the Origin for the same reason.
 *
 * It navigates on failure too. Whatever went wrong, the reader asked to be
 * signed out and `/account/login` is where they should end up; if the cookie
 * survived, that page will bounce them straight back to `/account`, which is
 * at least honest about what happened.
 */
export default function LogoutButton() {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/account/logout", { method: "POST" });
    } catch {
      // Fall through: navigate anyway.
    }
    // A full document load: the cookie has just been cleared, and the router
    // cache still holds the signed-in render of every page it has seen.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/account/login");
  }

  return (
    <div className={styles.logout}>
      <button
        className={styles.logoutButton}
        type="button"
        onClick={onClick}
        disabled={busy}
      >
        {busy ? "Logging out..." : "Log out"}
      </button>
    </div>
  );
}
