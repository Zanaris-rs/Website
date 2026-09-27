"use client";

import { useState } from "react";

import { ADVENTURE_CATEGORIES, isHidden } from "@/lib/adventurer-log/categories";
import { send } from "@/lib/adventurer-log/client";
import { ABOUT_MAX, PUBLIC_DELAY_MINUTES } from "@/lib/adventurer-log/format";

import styles from "./Settings.module.css";

type About = { about: string; hidden: number };

/**
 * The settings page's "About you" box: what the log says about its owner,
 * and which kinds of adventure it shows. Nothing is saved until Save, which
 * sends both at once (`/api/adventurer-log/about`), so the page and the log
 * never disagree about half of them. The headline is on the Character tab
 * now (`/account/adventurer-log/character`).
 */
export default function AboutYou({ initial }: { initial: About }) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dirty = draft.about !== saved.about || draft.hidden !== saved.hidden;

  function change(next: Partial<About>) {
    setDraft((current) => ({ ...current, ...next }));
    setStatus(null);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const sent = draft;
    const hidden = ADVENTURE_CATEGORIES.filter((category) => isHidden(sent.hidden, category.id)).map(
      (category) => category.id,
    );
    const result = await send("/api/adventurer-log/about", {
      about: sent.about,
      hidden,
    });
    setBusy(false);
    if (!result.ok) {
      setStatus(result.message);
      return;
    }
    // The server trims the text; what it kept is what is saved.
    const kept = {
      about: typeof result.data.about === "string" ? result.data.about : sent.about,
      hidden: sent.hidden,
    };
    setSaved(kept);
    setDraft((current) => (current === sent ? kept : current));
    setStatus("Saved.");
  }

  return (
    <form onSubmit={save} className={styles.form}>
      <p className={styles.hint}>Your headline is now on the Your character tab.</p>
      <label>
        About <span className={styles.count}>{draft.about.length}/{ABOUT_MAX}</span>
        <textarea
          rows={6}
          value={draft.about}
          maxLength={ABOUT_MAX}
          onChange={(event) => change({ about: event.target.value })}
        />
      </label>

      <fieldset className={styles.fieldset}>
        <legend>What your log shows</legend>
        <p className={styles.hint}>
          Everyone else sees an adventure {PUBLIC_DELAY_MINUTES} minutes after it happens; you see yours at
          once. Unticked kinds are hidden for everyone, you included.
        </p>
        <ul className={styles.categories}>
          {ADVENTURE_CATEGORIES.map((category) => (
            <li key={category.id}>
              <label>
                <input
                  type="checkbox"
                  checked={!isHidden(draft.hidden, category.id)}
                  onChange={(event) =>
                    change({
                      hidden: event.target.checked
                        ? draft.hidden & ~(1 << category.id)
                        : draft.hidden | (1 << category.id),
                    })
                  }
                />{" "}
                {category.label}
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className={styles.row}>
        <button type="submit" disabled={busy || !dirty}>
          Save
        </button>
        <span role="status">{dirty && !busy ? "You have unsaved changes." : status}</span>
      </div>
    </form>
  );
}
