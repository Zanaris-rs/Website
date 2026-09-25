"use client";

import { useEffect, useId, useRef, useState } from "react";

import Tile from "@/components/site/Tile";
import { itemPicture, type Picture, SITE_ART, SKILL_PICTURES, TEXTURE_PICTURES } from "@/lib/adventurer-log/pictures";

import styles from "./CssEditor.module.css";

export type PictureSource = "site" | "textures" | "skills" | "items";

type Source = PictureSource;

const SOURCES: readonly [Source, string][] = [
  ["site", "The 2004 site"],
  ["textures", "Game textures"],
  ["skills", "Skills"],
  ["items", "Items"],
];

const LISTS: Record<Exclude<Source, "items">, readonly Picture[]> = {
  site: SITE_ART,
  textures: TEXTURE_PICTURES,
  skills: SKILL_PICTURES,
};

/** How big a picture is drawn in the grid, whatever its own size. */
const THUMB = 48;

type Match = { kind: "item"; id: number; name: string } | { kind: "skill" };

/**
 * "Insert a picture": a modal dialog of the pictures a log's stylesheet may
 * use (`lib/adventurer-log/pictures.ts`), one kind at a time so only those
 * pictures load. Choosing one closes it and hands its URL to `onPick`;
 * Escape or Close just closes it. The page puts the cursor back in the
 * editor either way (`onClose`).
 *
 * It is mounted only while it is open, and opens itself: a native <dialog>
 * shown with showModal(), which keeps focus inside it and the rest of the
 * page out of reach until it closes.
 */
export default function PicturePicker({
  source,
  onSource,
  onPick,
  onClose,
}: {
  /** Which kind it shows; the page keeps it, so it reopens where it was. */
  source: PictureSource;
  onSource: (source: PictureSource) => void;
  onPick: (src: string) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Picture[]>([]);
  /** The search the items are the answer to. */
  const [answered, setAnswered] = useState("");
  const searchSeq = useRef(0);
  const id = useId();

  useEffect(() => {
    // No cleanup that closes it: unmounting removes it, which ends the modal,
    // and a close here would run twice in development (StrictMode) and shut
    // the dialog it had just opened.
    const box = dialog.current;
    if (box && !box.open) box.showModal();
  }, []);

  async function search(value: string) {
    setQuery(value);
    const seq = ++searchSeq.current;
    const q = value.trim();
    if (q.length < 2) {
      setItems([]);
      setAnswered(q);
      return;
    }
    try {
      const response = await fetch(`/api/adventurer-log/assets?q=${encodeURIComponent(q)}`);
      const body = (await response.json()) as { matches?: Match[] };
      if (seq !== searchSeq.current) return;
      setItems(
        (body.matches ?? []).flatMap((match) => {
          const picture = match.kind === "item" ? itemPicture(match.id, match.name) : null;
          return picture ? [picture] : [];
        }),
      );
      setAnswered(q);
    } catch {
      if (seq !== searchSeq.current) return;
      setItems([]);
      setAnswered(q);
    }
  }

  function pick(src: string) {
    // Closed first: while a modal dialog is open nothing outside it can take
    // focus, and the editor is about to.
    dialog.current?.close();
    onPick(src);
  }

  const pictures = source === "items" ? items : LISTS[source];

  return (
    <dialog ref={dialog} className={styles.picker} aria-labelledby={`${id}-title`} onClose={onClose}>
      <h2 id={`${id}-title`} className={styles.pickerTitle}>
        Insert a picture
      </h2>
      <p className={styles.hint}>
        Only this site&rsquo;s own pictures can be in your log. The one you choose goes where the cursor is, as{" "}
        <code>url(&hellip;)</code>.
      </p>

      <fieldset className={styles.sources}>
        <legend>Pictures from</legend>
        {SOURCES.map(([value, label]) => (
          <label key={value}>
            <input
              type="radio"
              name={`${id}-source`}
              value={value}
              checked={source === value}
              onChange={() => onSource(value)}
            />{" "}
            {label}
          </label>
        ))}
      </fieldset>

      {source === "items" ? (
        <input
          type="search"
          className={styles.search}
          aria-label="Search items"
          placeholder="Search items, e.g. rune"
          value={query}
          onChange={(event) => search(event.target.value)}
          onKeyDown={(event) => {
            // A search box takes the first Escape to empty itself; here
            // Escape closes the picker, as it does everywhere else in it.
            if (event.key === "Escape") {
              event.preventDefault();
              dialog.current?.close();
            }
          }}
          autoFocus
        />
      ) : null}

      <ul className={styles.grid} aria-label={SOURCES.find(([value]) => value === source)?.[1]}>
        {pictures.map((picture) => (
          <li key={picture.src}>
            <button
              type="button"
              className={styles.thumb}
              onClick={() => pick(picture.src)}
              title={`${picture.name}, ${picture.width}x${picture.height}`}
            >
              <Tile
                src={picture.src}
                width={THUMB}
                height={THUMB}
                className={
                  picture.width < THUMB && picture.height < THUMB ? `${styles.thumbImage} ${styles.pixelated}` : styles.thumbImage
                }
              />
              <span className={styles.thumbName}>{picture.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {source === "items" && items.length === 0 && answered === query.trim() ? (
        <p className={styles.hint}>
          {answered.length < 2 ? "Type at least two letters of an item's name." : "No item by that name."}
        </p>
      ) : null}

      <div className={styles.pickerClose}>
        <button type="button" onClick={() => dialog.current?.close()}>
          Close
        </button>
      </div>
    </dialog>
  );
}
