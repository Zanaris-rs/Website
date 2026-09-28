"use client";

import { type FormEvent, type ReactNode, useId, useState } from "react";

import { ADVENTURE_CATEGORIES, isHidden } from "@/lib/adventurer-log/categories";
import { send } from "@/lib/adventurer-log/client";
import { PUBLIC_DELAY_MINUTES } from "@/lib/adventurer-log/format";
import { SHEET_HREF } from "@/lib/adventurer-log/href";
import {
  FIXED_PART_LABELS,
  isPartHidden,
  PART_BITS,
  PART_KEYS,
  PART_LABELS,
  type PartKey,
  schematic,
  withBit,
} from "@/lib/adventurer-log/parts";

import styles from "./Settings.module.css";

/** The two masks this box saves: kinds of adventure (bit n, category n) and parts (`parts.ts`). */
type Shows = { categories: number; parts: number };

/** The parts that are always shown, and why. */
const FIXED = [
  { key: "card", label: FIXED_PART_LABELS.card, why: "Always shown: it is who you are." },
  { key: "skills", label: FIXED_PART_LABELS.skills, why: "Always shown: your hiscores are public anyway." },
] as const;

/** What each part the owner can hide is. */
const WHY: Record<PartKey, ReactNode> = {
  dialogue: "Your pages of words.",
  wardrobe: "Your saved outfits, for visitors to try on.",
  records: "Your best Start/Stop records.",
  about: (
    <>
      The About box, written on <a href={SHEET_HREF}>Character › Sheet</a>.
    </>
  ),
  adventures: "Your levels, quests, drops and posts.",
};

/**
 * Log settings' "What your log shows": the parts of the log, a tick each
 * (the character card and Skills always shown, and disabled, with the
 * reason), the kinds of adventure under "In your adventures" - disabled
 * while Adventures is unticked, since then none of them shows - and a
 * picture of the log beside them that drops each box as it is unticked
 * (`schematic`). Both masks go in one Save (`/api/adventurer-log/shows`), so
 * the page and the log never disagree about half of them. What is unticked
 * is hidden for everyone, the owner included.
 */
export default function LogShows({ initial }: { initial: Shows }) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();

  const dirty = draft.categories !== saved.categories || draft.parts !== saved.parts;
  const noAdventures = isPartHidden(draft.parts, "adventures");
  const layout = schematic(draft.parts);

  function change(next: Partial<Shows>) {
    setDraft((current) => ({ ...current, ...next }));
    setStatus(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    const sent = draft;
    const result = await send("/api/adventurer-log/shows", {
      hiddenCategories: ADVENTURE_CATEGORIES.filter((category) => isHidden(sent.categories, category.id)).map(
        (category) => category.id,
      ),
      hiddenParts: PART_KEYS.filter((key) => isPartHidden(sent.parts, key)),
    });
    setBusy(false);
    if (!result.ok) {
      setStatus(result.message);
      return;
    }
    setSaved(sent);
    setStatus("Saved.");
  }

  return (
    <form onSubmit={save} className={styles.form}>
      <div className={styles.shows}>
        <div className={styles.showsForm}>
          <fieldset className={styles.fieldset}>
            <legend>Parts of your log</legend>
            <p className={styles.hint}>
              Unticked parts are hidden for everyone, you included. Hiding Adventures also takes your log off the
              Recent activity lists.
            </p>
            <ul className={styles.parts}>
              {FIXED.map((part) => (
                <li key={part.key}>
                  <input
                    type="checkbox"
                    id={`${id}-${part.key}`}
                    checked
                    disabled
                    aria-describedby={`${id}-${part.key}-why`}
                  />
                  <label htmlFor={`${id}-${part.key}`}>{part.label}</label>
                  <span id={`${id}-${part.key}-why`} className={styles.why}>
                    {part.why}
                  </span>
                </li>
              ))}
              {PART_KEYS.map((key) => (
                <li key={key}>
                  <input
                    type="checkbox"
                    id={`${id}-${key}`}
                    checked={!isPartHidden(draft.parts, key)}
                    aria-describedby={`${id}-${key}-why`}
                    onChange={(event) =>
                      change({ parts: withBit(draft.parts, PART_BITS[key], !event.target.checked) })
                    }
                  />
                  <label htmlFor={`${id}-${key}`}>{PART_LABELS[key]}</label>
                  <span id={`${id}-${key}-why`} className={styles.why}>
                    {WHY[key]}
                  </span>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset className={styles.fieldset} disabled={noAdventures}>
            <legend>In your adventures</legend>
            <ul className={styles.categories}>
              {ADVENTURE_CATEGORIES.map((category) => (
                <li key={category.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={!isHidden(draft.categories, category.id)}
                      onChange={(event) =>
                        change({ categories: withBit(draft.categories, 1 << category.id, !event.target.checked) })
                      }
                    />{" "}
                    {category.label}
                  </label>
                </li>
              ))}
            </ul>
            <p className={styles.hint}>
              {noAdventures
                ? "Adventures are hidden, so these don’t apply."
                : `Which kinds of adventure appear on your log. Everyone else sees one ${PUBLIC_DELAY_MINUTES} minutes after it happens; you see yours at once.`}
            </p>
          </fieldset>
        </div>

        {/* A picture of what the ticks already say, so it is kept from screen readers. */}
        <figure className={styles.schematic} aria-hidden="true">
          <figcaption>Your log, as visitors see it</figcaption>
          <div className={styles.schematicLog}>
            {[layout.side, layout.main].map((column, i) => (
              <div key={i} className={i === 0 ? styles.schematicSide : styles.schematicMain}>
                {column.map((block) => (
                  <div key={block.key} className={styles.block} style={{ height: block.height }}>
                    {block.label}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </figure>
      </div>

      <div className={styles.row}>
        <button type="submit" disabled={busy || !dirty}>
          Save
        </button>
        <span role="status">{dirty && !busy ? "You have unsaved changes." : status}</span>
      </div>
    </form>
  );
}
