"use client";

import { useState } from "react";

import { send } from "@/lib/adventurer-log/client";
import { CSS_MAX } from "@/lib/adventurer-log/format";

/**
 * The owner's stylesheet: a textarea, the classes it can style, and a skin
 * to start from. Saving answers with what the log will leave out, and why.
 */

const CLASSES: readonly [string, string][] = [
  [".al-page", "the whole log (html, body and :root mean this too)"],
  [".al-side / .al-main", "the narrow and the wide column"],
  [".al-box, .al-box > h2", "every box, and its title bar"],
  [".al-header, .al-title, .al-chathead, .al-headline", "who you are"],
  [".al-stats, .al-skill", "the skills table (.al-skill--<category> for one)"],
  [".al-about", "about you"],
  [".al-timeline, .al-entries", "the timeline"],
  [".al-event, .al-event--level, --milestone, --quest, --drop, --clue, --random, --tutorial, --other", "an adventure, and by kind"],
  [".al-update, .al-update-body, .al-reply, .al-reply-body", "updates and replies"],
  [".al-avatar, .al-name, .al-time, .al-asset", "chatheads, names, dates, game pictures"],
];

const STARTER = `/* A 2004 skin to start from. Change anything. */
body {
  background: #0d1b3d url(/img/background.jpg);
  font-family: Verdana, Arial, sans-serif;
}
.al-box {
  background: #fff8e7;
  border: 2px solid #ff9900;
  color: #333;
}
.al-box > h2 {
  background: #ff9900;
  color: #fff;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.al-title {
  color: #ffcc00;
  text-shadow: 1px 1px 0 #000;
}
.al-name, .al-links a {
  color: #0033cc;
}
.al-time {
  color: #996633;
}
.al-headline::before {
  content: "★ ";
  color: #ff9900;
}
@keyframes sparkle {
  50% { opacity: 0.6; }
}
.al-chathead {
  animation: sparkle 2s ease-in-out infinite;
}
`;

export default function CssEditor({ initial, disabled }: { initial: string; disabled: boolean }) {
  const [css, setCss] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [dropped, setDropped] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await send("/api/adventurer-log/css", { css });
    setBusy(false);
    if (!result.ok) {
      setStatus(result.message);
      setDropped([]);
      return;
    }
    setStatus("Saved.");
    setDropped(Array.isArray(result.data.dropped) ? (result.data.dropped as string[]) : []);
  }

  return (
    <form onSubmit={save}>
      <h2 style={{ margin: "0 0 6px", fontSize: 14 }}>Your log&rsquo;s style</h2>
      {disabled ? (
        <p role="status">Staff have turned off your log&rsquo;s stylesheet, so it cannot be changed.</p>
      ) : null}
      <p style={{ margin: "0 0 6px", color: "var(--text-muted)" }}>
        CSS for your log, and nothing outside it. Pictures from the site&rsquo;s own <code>/img/</code> only;
        no <code>@import</code>, fonts or links elsewhere; <code>content</code> can draw symbols but not words.
      </p>
      <textarea
        value={css}
        onChange={(event) => setCss(event.target.value)}
        maxLength={CSS_MAX}
        rows={16}
        spellCheck={false}
        disabled={disabled}
        style={{ width: "100%", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" disabled={busy || disabled}>
          Save style
        </button>
        <button type="button" disabled={disabled} onClick={() => setCss(STARTER)}>
          Start from the 2004 skin
        </button>
        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
          {css.length}/{CSS_MAX}
        </span>
        <span role="status">{status}</span>
      </div>
      {dropped.length > 0 ? (
        <div role="status">
          <p style={{ margin: "6px 0 2px" }}>Your log leaves these out:</p>
          <ul style={{ margin: 0 }}>
            {dropped.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <details style={{ marginTop: 8 }}>
        <summary>What you can style</summary>
        <ul style={{ margin: "4px 0 0" }}>
          {CLASSES.map(([selector, what]) => (
            <li key={selector}>
              <code>{selector}</code> &mdash; {what}
            </li>
          ))}
        </ul>
      </details>
    </form>
  );
}
