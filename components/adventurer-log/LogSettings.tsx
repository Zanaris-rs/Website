"use client";

import { useState } from "react";

import { ADVENTURE_CATEGORIES, isHidden } from "@/lib/adventurer-log/categories";
import { send } from "@/lib/adventurer-log/client";
import { ABOUT_MAX, HEADLINE_MAX, PUBLIC_DELAY_MINUTES } from "@/lib/adventurer-log/format";

import styles from "./Settings.module.css";

/**
 * The owner's side of their log: what it says about them, and which kinds of
 * adventure it shows. Each form saves on its own.
 */
export default function LogSettings({
  headline: initialHeadline,
  about: initialAbout,
  hidden: initialHidden,
}: {
  headline: string;
  about: string;
  hidden: number;
}) {
  const [headline, setHeadline] = useState(initialHeadline);
  const [about, setAbout] = useState(initialAbout);
  const [hidden, setHidden] = useState(initialHidden);
  const [textStatus, setTextStatus] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function saveText(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await send("/api/adventurer-log/profile", { headline, about });
    setTextStatus(result.ok ? "Saved." : result.message);
    setBusy(false);
  }

  async function saveFilters(next: number) {
    setHidden(next);
    setBusy(true);
    const ids = ADVENTURE_CATEGORIES.filter((category) => isHidden(next, category.id)).map(
      (category) => category.id,
    );
    const result = await send("/api/adventurer-log/filters", { hidden: ids });
    setFilterStatus(result.ok ? "Saved." : result.message);
    setBusy(false);
  }

  return (
    <div className={styles.settings}>
      <form onSubmit={saveText} className={styles.form}>
        <h2>About you</h2>
        <label>
          Headline <span className={styles.count}>{headline.length}/{HEADLINE_MAX}</span>
          <input
            type="text"
            value={headline}
            maxLength={HEADLINE_MAX}
            onChange={(event) => setHeadline(event.target.value)}
          />
        </label>
        <label>
          About <span className={styles.count}>{about.length}/{ABOUT_MAX}</span>
          <textarea
            rows={6}
            value={about}
            maxLength={ABOUT_MAX}
            onChange={(event) => setAbout(event.target.value)}
          />
        </label>
        <div className={styles.row}>
          <button type="submit" disabled={busy}>
            Save
          </button>
          <span role="status">{textStatus}</span>
        </div>
      </form>

      <div className={styles.form}>
        <h2>What your log shows</h2>
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
                  checked={!isHidden(hidden, category.id)}
                  disabled={busy}
                  onChange={(event) =>
                    saveFilters(
                      event.target.checked ? hidden & ~(1 << category.id) : hidden | (1 << category.id),
                    )
                  }
                />{" "}
                {category.label}
              </label>
            </li>
          ))}
        </ul>
        <span role="status">{filterStatus}</span>
      </div>
    </div>
  );
}
