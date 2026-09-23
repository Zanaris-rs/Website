"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import account from "@/components/account/Account.module.css";
import frame from "@/components/site/Frame.module.css";
import { parseRecordCurrentResponse, type RecordCurrentResponse } from "@/lib/records/api";
import { DEFAULT_DURATION, RECORD_DURATIONS, recordDuration } from "@/lib/records/durations";
import { formatCountdown, formatElapsed } from "@/lib/records/format";
import { clockOffset, logoutStanding, pollDelay, timerAt } from "@/lib/records/timer";
import { PRESENCE_LINES, START_LABEL, STOP_LABEL, messageFor } from "@/lib/records/verdict";

import styles from "./Records.module.css";

/**
 * Start, Stop, Cancel and the timer.
 *
 * The page renders with the database's answer; this re-reads it every few
 * seconds while the tab is visible (and not at all while it is hidden) so the
 * "logged in / logged out" line keeps up with the game and the countdown stays
 * on the database's clock. The countdown itself ticks locally between reads.
 *
 * After any action, and whenever a read shows the attempt has changed under
 * it (stopped from another tab, say), the server page is re-read with
 * `router.refresh()` rather than patched in place, so the verdict and the
 * history below are always what the database says.
 */

type Busy =
  | { kind: "idle" }
  | { kind: "working"; action: Action }
  | { kind: "failed"; message: string };

type Action = "start" | "stop" | "abandon";

/** How many times Start or Stop quietly retries through the five-second settle. */
const SYNC_RETRIES = 3;
const SYNC_RETRY_MS = 2_000;

function signature(current: RecordCurrentResponse): string {
  return current.attempt ? `${current.attempt.id}:${current.attempt.state}` : "none";
}

export default function RecordLive({
  initial,
  blocked,
}: {
  initial: RecordCurrentResponse;
  /** Set when the account can never start one: staff above level 1, or banned. */
  blocked: "staff" | "banned" | null;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(initial);
  // Seeded together, so `now + offset` is exactly `serverNow` on the first
  // render - on the server and in the browser alike, which keeps hydration
  // quiet. Every poll refines the offset; the ticker moves `now`.
  const [clock, setClock] = useState(() => {
    const at = Date.now();
    return { now: at, offset: clockOffset(initial.serverNow, at) };
  });
  const [busy, setBusy] = useState<Busy>({ kind: "idle" });
  // Which length the next Start asks for. Browser state on purpose: the
  // database is asked for a duration at Start and remembers it from then on,
  // so there is nothing to keep between attempts.
  const [chosen, setChosen] = useState(DEFAULT_DURATION);
  const seen = useRef(signature(initial));
  const lastPresence = useRef(initial.presence);

  const attempt = current.attempt;
  const running = attempt?.state === "running";

  // The countdown ticks locally, four times a second, only while one runs.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setClock((c) => ({ ...c, now: Date.now() })), 250);
    return () => window.clearInterval(id);
  }, [running]);

  // Poll while visible. A read that shows a different attempt, or the same
  // one in a different state, re-reads the whole page.
  useEffect(() => {
    let timer: number | undefined;
    let active = true;

    async function read() {
      try {
        const response = await fetch("/api/records/current", { cache: "no-store" });
        if (!response.ok) return;
        const next = parseRecordCurrentResponse(await response.json());
        if (!active) return;
        setCurrent(next);
        // An error about being in the game is stale once the game says otherwise.
        if (next.presence !== lastPresence.current) {
          lastPresence.current = next.presence;
          setBusy((b) => (b.kind === "failed" ? { kind: "idle" } : b));
        }
        const at = Date.now();
        setClock({ now: at, offset: clockOffset(next.serverNow, at) });
        if (signature(next) !== seen.current) {
          seen.current = signature(next);
          router.refresh();
        }
      } catch {
        // A missed read is not worth a message: the next one is five seconds away.
      }
    }

    function schedule() {
      window.clearTimeout(timer);
      const delay = pollDelay(document.hidden);
      if (delay === null) return;
      timer = window.setTimeout(async () => {
        await read();
        if (active) schedule();
      }, delay);
    }

    function onVisibility() {
      if (!document.hidden) void read();
      schedule();
    }

    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  const act = useCallback(
    async (action: Action) => {
      setBusy({ kind: "working", action });

      for (let attempt = 0; ; attempt++) {
        try {
          const response = await fetch(`/api/records/${action}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: action === "start" ? JSON.stringify({ duration: chosen.seconds }) : undefined,
          });
          if (response.ok) {
            setBusy({ kind: "idle" });
            router.refresh();
            return;
          }

          const body: unknown = await response.json().catch(() => null);
          const code = (body as { error?: string } | null)?.error ?? "unavailable";

          // Logged out a moment ago: the hiscore write may still be landing.
          // It will have in a few seconds, so wait rather than make the
          // player click again.
          if (code === "syncing" && attempt < SYNC_RETRIES) {
            await new Promise((resolve) => window.setTimeout(resolve, SYNC_RETRY_MS));
            continue;
          }

          setBusy({ kind: "failed", message: messageFor(code) });
          return;
        } catch {
          setBusy({ kind: "failed", message: messageFor("unavailable") });
          return;
        }
      }
    },
    [router, chosen],
  );

  const working = busy.kind === "working";
  const duration = (attempt && recordDuration(attempt.durationSeconds)) || DEFAULT_DURATION;

  return (
    <div className={styles.live}>
      <p className={styles.presence} role="status">
        {PRESENCE_LINES[current.presence]}
      </p>

      {running && attempt ? (
        <RunningTimer
          startedAt={attempt.startedAt}
          durationSeconds={attempt.durationSeconds}
          graceSeconds={attempt.graceSeconds ?? duration.graceSeconds}
          presence={current.presence}
          logoutTime={current.logoutTime}
          offset={clock.offset}
          now={clock.now}
        />
      ) : null}

      {/* Which length to go for. Hidden while one runs, because the length is
          then the attempt's and not a choice, and while the account is blocked,
          because there is nothing to start. */}
      {!running && !blocked ? (
        <div className={styles.durations}>
          <span className={styles.durationsLabel}>Record length</span>
          {RECORD_DURATIONS.map((entry) => (
            <button
              key={entry.seconds}
              type="button"
              className={`${styles.duration} ${entry.seconds === chosen.seconds ? styles.durationOn : ""}`}
              aria-pressed={entry.seconds === chosen.seconds}
              onClick={() => setChosen(entry)}
              disabled={working}
            >
              {entry.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className={account.actions}>
        {running ? (
          <>
            <button
              className={account.submit}
              type="button"
              onClick={() => void act("stop")}
              disabled={working}
            >
              {working && busy.action === "stop" ? "Stopping..." : STOP_LABEL}
            </button>{" "}
            <button
              className={styles.linkButton}
              type="button"
              onClick={() => void act("abandon")}
              disabled={working}
            >
              Cancel this attempt
            </button>
          </>
        ) : blocked ? (
          <p className={account.note}>{messageFor(blocked)}</p>
        ) : (
          <button
            className={account.submit}
            type="button"
            onClick={() => void act("start")}
            disabled={working || current.presence !== "logged_out"}
          >
            {working && busy.action === "start" ? "Starting..." : START_LABEL}
          </button>
        )}
      </div>

      {!running && !blocked && current.presence === "logged_in" ? (
        <p className={account.note}>Log out of the game first, then press {START_LABEL}.</p>
      ) : null}

      {busy.kind === "failed" ? (
        <p className={account.error} role="alert">
          {busy.message}
        </p>
      ) : null}

      {running ? (
        <p className={account.note}>
          The time that counts is when you log out, not when you press {STOP_LABEL} — but
          press it before you log in again.{" "}
          <a className={frame.link} href="/serverlist">
            Choose a world
          </a>
        </p>
      ) : null}
    </div>
  );
}

function RunningTimer({
  startedAt,
  durationSeconds,
  graceSeconds,
  presence,
  logoutTime,
  offset,
  now,
}: {
  startedAt: string;
  durationSeconds: number;
  graceSeconds: number;
  presence: RecordCurrentResponse["presence"];
  logoutTime: string | null;
  offset: number;
  now: number;
}) {
  // Logged out since Start: the window is already decided, whatever the
  // clock says now. Freeze on the logout and say whether it made it.
  const standing = logoutStanding(startedAt, durationSeconds, graceSeconds, presence, logoutTime);
  if (standing) {
    return (
      <div className={styles.timer} aria-live="polite">
        <div className={`${styles.clock} ${standing.inTime ? frame.green : frame.red}`}>
          {formatElapsed(standing.elapsedMs)}
        </div>
        <div className={styles.phase}>
          {standing.inTime
            ? `You logged out at ${formatElapsed(standing.elapsedMs)} — in time. Press ${STOP_LABEL} to save it.`
            : `You logged out at ${formatElapsed(standing.elapsedMs)} — past the window. Press ${STOP_LABEL} to see what you gained; it won't count as a record.`}
        </div>
      </div>
    );
  }

  const view = timerAt(startedAt, durationSeconds, graceSeconds, offset, now);

  return (
    <div className={styles.timer} aria-live="polite">
      <div
        className={[
          styles.clock,
          view.phase === "warning" || view.phase === "grace" ? frame.yellow : "",
          view.phase === "over" ? frame.red : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {formatCountdown(view.leftMs)}
      </div>
      <div className={styles.phase}>
        {view.phase === "running" ? "left — play, then log out before 0:00." : null}
        {view.phase === "warning" ? "Leave combat and log out now." : null}
        {view.phase === "grace"
          ? `Time's up — log out now. ${Math.ceil(view.graceLeftMs / 1000)}s of grace left.`
          : null}
        {view.phase === "over"
          ? `Past the window and its grace. Log out and press ${STOP_LABEL} to see what you gained — it won't count as a record.`
          : null}
      </div>
    </div>
  );
}
