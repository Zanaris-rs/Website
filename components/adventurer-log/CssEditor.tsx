"use client";

import { type ComponentType, useEffect, useId, useImperativeHandle, useRef, useState } from "react";

import { send } from "@/lib/adventurer-log/client";
import type { Dropped } from "@/lib/adventurer-log/css";
import { CSS_MAX } from "@/lib/adventurer-log/format";
import frame from "@/components/site/Frame.module.css";
import { cssUrl } from "@/lib/adventurer-log/pictures";

import type { CodeHandle, CodeProps, Lint } from "./CssCode";
import styles from "./CssEditor.module.css";
import PicturePicker, { type PictureSource } from "./PicturePicker";
import settings from "./Settings.module.css";

/**
 * The owner's stylesheet: a code editor, the classes it can style, a skin to
 * start from, and a picker for the site's pictures. The log itself is where
 * a saved stylesheet is seen; this page draws none of it.
 *
 * The draft goes to `POST /api/adventurer-log/css/check` once typing pauses,
 * through the same sanitiser the log uses, and what it would leave out is
 * listed and marked on its line in the editor. Nothing is saved until Save.
 *
 * The page renders what the sanitiser made of the saved sheet, so the first
 * paint's marks are already right.
 */

const CLASSES: readonly [string, string][] = [
  [".al-page", "the whole log (html, body and :root mean this too)"],
  [".al-side / .al-main", "the narrow and the wide column"],
  [".al-box, .al-box > h2", "every box, and its title bar"],
  [".al-header, .al-title, .al-chathead, .al-headline", "who you are"],
  [".al-stats, .al-skill", "the skills table (.al-skill--<category> for one)"],
  [".al-about", "about you"],
  [".al-wardrobe, .al-outfits, .al-outfit, .al-outfit--default, .al-outfit-name", "your outfits (--default is your picture)"],
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

/** How long typing has to pause before the draft is checked. */
const CHECK_DELAY_MS = 400;

function asDropped(raw: unknown): Dropped[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item: unknown) => {
    if (typeof item !== "object" || item === null) return [];
    const { reason, line } = item as { reason?: unknown; line?: unknown };
    if (typeof reason !== "string") return [];
    return [Number.isInteger(line) ? { reason, line: line as number } : { reason }];
  });
}

/** One line per reason, with the lines it was found on. */
function byReason(dropped: readonly Dropped[]): [string, number[]][] {
  const out = new Map<string, number[]>();
  for (const item of dropped) {
    const lines = out.get(item.reason) ?? [];
    if (item.line !== undefined && !lines.includes(item.line)) lines.push(item.line);
    out.set(item.reason, lines);
  }
  return [...out];
}

/**
 * The box before CodeMirror has loaded, and instead of it if it cannot: the
 * server renders this, so with no JavaScript the stylesheet is still there to
 * read.
 */
function PlainCode({ value, onChange, max, onTooLong, disabled, label, describedBy, handle }: CodeProps) {
  const area = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(
    handle,
    () => ({
      insert(text: string) {
        const box = area.current;
        if (!box) return;
        const start = box.selectionStart;
        const next = box.value.slice(0, start) + text + box.value.slice(box.selectionEnd);
        if (next.length > max) return onTooLong();
        onChange(next);
        requestAnimationFrame(() => {
          box.focus();
          box.setSelectionRange(start + text.length, start + text.length);
        });
      },
      focus() {
        area.current?.focus();
      },
    }),
    [max, onChange, onTooLong],
  );

  return (
    <textarea
      ref={area}
      className={styles.plain}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      maxLength={max}
      rows={16}
      spellCheck={false}
      disabled={disabled}
      aria-label={label}
      aria-describedby={describedBy}
    />
  );
}

export default function CssEditor({
  initial,
  disabled,
  dropped,
  logHref,
}: {
  initial: string;
  disabled: boolean;
  /** What the sanitiser leaves out of `initial`, from the page's own render. */
  dropped: Dropped[];
  /** The owner's log, where the saved stylesheet is drawn. */
  logHref: string;
}) {
  const [saved, setSaved] = useState(initial);
  const [css, setCss] = useState(initial);
  const [shown, setShown] = useState<Lint>({ text: initial, dropped });
  const [checkError, setCheckError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [pictureSource, setPictureSource] = useState<PictureSource>("site");
  const [Code, setCode] = useState<ComponentType<CodeProps>>(() => PlainCode);
  const code = useRef<CodeHandle | null>(null);
  const checkSeq = useRef(0);
  const id = useId();

  const dirty = css !== saved;

  // CodeMirror, only here and only in the browser: a dynamic import is its
  // own chunk, which no other page loads.
  useEffect(() => {
    let live = true;
    import("./CssCode").then(
      (module) => {
        if (live) setCode(() => module.default);
      },
      () => {
        // The textarea stays, and does the same job.
      },
    );
    return () => {
      live = false;
    };
  }, []);

  // The marks follow the draft once typing pauses. Only the newest answer
  // is kept: any answer still on its way when the draft changes again (an
  // undo back to what is marked, too) is for a draft already gone.
  useEffect(() => {
    const seq = ++checkSeq.current;
    if (disabled || css === shown.text) return;
    const timer = setTimeout(async () => {
      const result = await send("/api/adventurer-log/css/check", { css });
      if (seq !== checkSeq.current) return;
      if (!result.ok) {
        setCheckError(result.message);
        return;
      }
      setCheckError(null);
      setShown({ text: css, dropped: asDropped(result.data.dropped) });
    }, CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [css, disabled, shown.text]);

  function change(next: string) {
    setCss(next);
    setStatus(null);
  }

  function tooLong() {
    setStatus(`Your stylesheet can be at most ${CSS_MAX} characters.`);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const sent = css;
    const result = await send("/api/adventurer-log/css", { css: sent });
    setBusy(false);
    if (!result.ok) {
      setStatus(result.message);
      return;
    }
    setSaved(sent);
    setStatus("Saved.");
  }

  const reasons = byReason(shown.dropped);

  return (
    <div className={styles.editor}>
      {/* Only the form gets the settings page's form styles: they style every
          label and button inside, and the picker is not theirs to restyle. */}
      <form onSubmit={save} className={settings.form}>
        {disabled ? (
          <p role="status">Staff have turned off your log&rsquo;s stylesheet, so it cannot be changed.</p>
        ) : null}
        <p id={`${id}-rules`} className={settings.hint}>
          CSS for your log, and nothing outside it. Pictures from the site&rsquo;s own <code>/img/</code> only;
          no <code>@import</code>, fonts or links elsewhere; <code>content</code> can draw symbols but not words.
          Save it, then{" "}
          <a href={logHref} className={frame.link}>
            view your log
          </a>{" "}
          to see it.
        </p>
        <Code
          value={css}
          onChange={change}
          lint={shown}
          max={CSS_MAX}
          onTooLong={tooLong}
          disabled={disabled}
          label="Your log's stylesheet"
          describedBy={`${id}-rules`}
          handle={code}
        />
        <div className={`${settings.row} ${styles.actions}`}>
          <button type="submit" disabled={busy || disabled || !dirty}>
            Save style
          </button>
          <button type="button" disabled={disabled} onClick={() => change(STARTER)}>
            Start from the 2004 skin
          </button>
          <button type="button" disabled={disabled} onClick={() => setPicking(true)} aria-haspopup="dialog">
            Insert a picture
          </button>
          <span className={settings.count}>
            {css.length}/{CSS_MAX}
          </span>
          <span role="status">{dirty && !busy && !status ? "You have unsaved changes." : status}</span>
        </div>
      </form>

      {picking ? (
        <PicturePicker
          source={pictureSource}
          onSource={setPictureSource}
          onPick={(src) => code.current?.insert(cssUrl(src))}
          onClose={() => {
            setPicking(false);
            code.current?.focus();
          }}
        />
      ) : null}

      {checkError ? (
        <p role="status" className={styles.hint}>
          Your stylesheet could not be checked just now: {checkError}
        </p>
      ) : null}

      {reasons.length > 0 ? (
        <div role="status" className={styles.dropped}>
          <p>Your log leaves these out:</p>
          <ul>
            {reasons.map(([reason, lines]) => (
              <li key={reason}>
                {reason}
                {lines.length > 0 ? (
                  <span className={settings.count}>
                    {" "}
                    ({lines.length === 1 ? "line" : "lines"} {lines.join(", ")})
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <details className={styles.classes}>
        <summary>What you can style</summary>
        <ul>
          {CLASSES.map(([selector, what]) => (
            <li key={selector}>
              <code>{selector}</code> &mdash; {what}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
