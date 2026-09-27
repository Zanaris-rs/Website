"use client";

import { useEffect, useEffectEvent, useId, useState } from "react";

import Chathead from "@/components/game/Chathead";
import { useUnsavedGuard } from "@/components/site/useUnsavedGuard";
import type { Look } from "@/lib/chathead/look";
import { type OutfitStore, sameOutfit, type SavedOutfits } from "@/lib/chathead/outfit-store";
import { checkOutfit, defaultLook, kitChoices, OUTFIT_NAME_MAX, type Outfit } from "@/lib/chathead/validate";
import { swatchCss, wearables } from "@/lib/chathead/wearables";
import { type EditorStatus, editorStatusText } from "@/lib/outfits/editor-status";

import ItemPicker from "./ItemPicker";
import styles from "./Outfits.module.css";
import TurnableFigure from "./TurnableFigure";
import WornTab from "./WornTab";

/**
 * Fashionscape: one outfit - a look: body, colours, and anything the game
 * lets you wear - with its chathead and its figure drawn live as it changes.
 * Which outfit is the page's (`/character/outfit/<n>`): Character › Look's
 * grid is how a player moves between outfits, and wears one.
 *
 * The chathead shows the head, so only the hat, the hair and jaw, and the
 * hair and skin colours change it. The figure beside it is the whole body,
 * and turns.
 *
 * Nothing here changes the page's height (`Outfits.module.css`): the panel
 * beside the Worn Equipment tab is one size whatever it shows. Clicking a
 * worn slot switches it to that slot's items, and picking an item keeps it
 * open, marking the item worn.
 *
 * The draft is unsaved (`dirty`) when it differs from the outfit saved in
 * its slot - or, in an empty slot, from the fresh outfit it opened with - by
 * value: picking an item and then the one before is no change.
 *
 * While a request is out, Save, Save and wear, Delete and Import are
 * `aria-disabled` and ignore presses; `disabled` is only for what cannot be
 * done at all (nothing to save, nothing saved to delete). Editing goes on:
 * an edit made while a save or a delete is out stays, unsaved, rather than
 * being replaced by what was saved or by a fresh outfit, and the status
 * line says it has changed since (`editorStatusText`).
 */

const COLOUR_PARTS = ["Hair", "Torso", "Legs", "Feet", "Skin"] as const;
/** Which colours the chathead shows: hair (and beard) and skin. */
const HEAD_COLOURS = new Set([0, 4]);

const PANELS = [
  { key: "items", label: "Items" },
  { key: "body", label: "Body" },
  { key: "colours", label: "Colours" },
] as const;
type PanelKey = (typeof PANELS)[number]["key"];

function fresh(slot: number): Outfit {
  return { name: `Outfit ${slot + 1}`, look: defaultLook(0) };
}

function withLook(outfit: Outfit, change: (look: Look) => Partial<Look>) {
  return { ...outfit, look: { ...outfit.look, ...change(outfit.look) } };
}

export default function OutfitEditor({
  slot,
  initial,
  store,
  importOnLoad = false,
  lookHref = null,
  onChange,
}: {
  /** The slot edited, 0-9. */
  slot: number;
  initial: SavedOutfits;
  store: OutfitStore;
  /** Import the look from the game as the editor opens (Look's "Import your in-game look"). */
  importOnLoad?: boolean;
  /** Where "Look" in the heading goes; plain text without one. */
  lookHref?: string | null;
  /** Heard with the outfits as they are after each save, delete or wear. */
  onChange?: (saved: SavedOutfits) => void;
}) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState<Outfit>(() => initial.outfits[slot] ?? fresh(slot));
  const [panel, setPanel] = useState<PanelKey>("items");
  const [picking, setPicking] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<EditorStatus | null>(null);
  const ids = useId();

  const isSaved = saved.outfits[slot] !== null;
  const dirty = !sameOutfit(draft, saved.outfits[slot] ?? fresh(slot));
  useUnsavedGuard(dirty);

  const wearing = saved.defaultSlot === slot;
  const check = checkOutfit(draft);
  const title = draft.name.trim() || `Outfit ${slot + 1}`;

  /** Every change goes through the previous draft, so quick clicks add up. */
  function edit(change: (outfit: Outfit) => Outfit) {
    setDraft(change);
    setStatus(null);
  }

  async function run(action: () => Promise<SavedOutfits>, done: string): Promise<SavedOutfits | null> {
    setBusy(true);
    setStatus(null);
    try {
      const next = await action();
      setSaved(next);
      onChange?.(next);
      setStatus({ text: done, done: true });
      return next;
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "Something went wrong.", done: false });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save(): Promise<boolean> {
    if (busy || !check.ok) return false;
    const sent = draft;
    const outfit = check.outfit;
    const next = await run(() => store.save(slot, outfit), "Saved.");
    if (!next) return false;
    // What was saved becomes the draft, unless the draft moved on meanwhile.
    const kept = next.outfits[slot] ?? outfit;
    setDraft((current) => (sameOutfit(current, sent) ? kept : current));
    return true;
  }

  async function saveAndWear() {
    if (busy || !check.ok) return;
    if ((dirty || !isSaved) && !(await save())) return;
    await run(() => store.setDefault(slot), "Saved. You're wearing it now.");
  }

  async function remove() {
    if (busy || !window.confirm(`Delete "${saved.outfits[slot]?.name}"?`)) return;
    const sent = draft;
    const next = await run(() => store.remove(slot), "Deleted.");
    // A fresh outfit takes the empty slot, unless the draft moved on meanwhile.
    if (next) setDraft((current) => (sameOutfit(current, sent) ? fresh(slot) : current));
  }

  async function importLook() {
    if (busy || !store.importLook) return;
    setBusy(true);
    setStatus(null);
    try {
      const look = await store.importLook();
      if (look) {
        edit((outfit) => ({ ...outfit, look }));
        setStatus({ text: "Imported your look from your last save. Save to keep it.", done: false });
      } else {
        setStatus({
          text: "The game has not recorded your look yet. Log in, then log out, and try again.",
          done: false,
        });
      }
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : "Import failed.", done: false });
    } finally {
      setBusy(false);
    }
  }

  // "Import your in-game look" on the Look tab opens this with ?import=1:
  // the imported look arrives as an unsaved draft. The query goes from the
  // address first, so a reload opens the editor rather than a second import.
  const importNow = useEffectEvent(() => {
    void importLook();
  });
  useEffect(() => {
    if (!importOnLoad) return;
    let live = true;
    queueMicrotask(() => {
      if (!live) return;
      window.history.replaceState(null, "", window.location.pathname);
      importNow();
    });
    return () => {
      live = false;
    };
  }, [importOnLoad]);

  function setGender(gender: number) {
    if (gender === draft.look.gender) return;
    // The design screen's own behaviour: a new body of the default kits.
    edit((outfit) => withLook(outfit, () => ({ gender, kits: defaultLook(gender).kits })));
  }

  function cycleKit(part: number, step: number) {
    edit((outfit) =>
      withLook(outfit, (look) => {
        const choices = kitChoices(look.gender, part);
        if (choices.length === 0) return {};
        const at = choices.indexOf(look.kits[part]);
        const kits = [...look.kits];
        kits[part] = choices[(at + step + choices.length) % choices.length];
        return { kits };
      }),
    );
  }

  function setColour(part: number, colour: number) {
    edit((outfit) =>
      withLook(outfit, (look) => {
        const colours = [...look.colours];
        colours[part] = colour;
        return { colours };
      }),
    );
  }

  function wear(wornSlot: number, obj: number) {
    edit((outfit) =>
      withLook(outfit, (look) => {
        const worn = [...look.worn];
        worn[wornSlot] = obj;
        return { worn };
      }),
    );
  }

  function pick(wornSlot: number) {
    setPicking(wornSlot);
    setPanel("items");
  }

  const kitRows = [
    { part: 0, label: "Hair" },
    ...(draft.look.gender === 0 ? [{ part: 1, label: "Jaw" }] : []),
  ];

  return (
    <div className={styles.editor}>
      <h2 className={styles.heading}>
        {lookHref ? <a href={lookHref}>Look</a> : "Look"} › Editing {title}
        {wearing ? <span className={styles.wearingBadge}>Wearing</span> : null}
      </h2>

      <div className={styles.workbench}>
        <div className={styles.previews}>
          <figure className={styles.preview}>
            <Chathead look={draft.look} label={`${title}, chathead`} />
            <figcaption>Chathead</figcaption>
          </figure>
          <figure className={styles.preview}>
            <TurnableFigure look={draft.look} label={`${title}, whole body`} />
            <figcaption>Drag, or use ← →, to turn</figcaption>
          </figure>
        </div>

        <div className={styles.wornColumn}>
          <WornTab worn={draft.look.worn} picking={picking} onPick={pick} />
          <p className={styles.hint}>Click a slot to choose what to wear.</p>
        </div>

        <div className={styles.panel}>
          <div role="tablist" aria-label="Outfit" className={styles.panelTabs}>
            {PANELS.map((entry) => (
              <button
                key={entry.key}
                type="button"
                role="tab"
                id={`${ids}-${entry.key}`}
                aria-selected={panel === entry.key}
                aria-controls={`${ids}-panel`}
                className={styles.panelTab}
                onClick={() => setPanel(entry.key)}
              >
                {entry.label}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`${ids}-panel`}
            aria-labelledby={`${ids}-${panel}`}
            className={panel === "items" ? styles.panelItems : styles.panelBody}
          >
            {panel === "items" ? (
              picking === null ? (
                <p className={styles.empty}>Click a slot on the Worn Equipment tab to see what can be worn there.</p>
              ) : (
                <ItemPicker
                  key={picking}
                  slot={picking}
                  worn={draft.look.worn[picking] ?? -1}
                  onWear={(obj) => wear(picking, obj)}
                />
              )
            ) : panel === "body" ? (
              <>
                <div className={styles.genders}>
                  {["Male", "Female"].map((label, gender) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={draft.look.gender === gender}
                      onClick={() => setGender(gender)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {kitRows.map(({ part, label }) => {
                  const choices = kitChoices(draft.look.gender, part);
                  const at = choices.indexOf(draft.look.kits[part]);
                  return (
                    <div key={part} className={styles.kitRow}>
                      <button
                        type="button"
                        aria-label={`Previous ${label.toLowerCase()}`}
                        onClick={() => cycleKit(part, -1)}
                      >
                        ‹
                      </button>
                      <span>
                        {label} {at + 1} of {choices.length}
                      </span>
                      <button
                        type="button"
                        aria-label={`Next ${label.toLowerCase()}`}
                        onClick={() => cycleKit(part, 1)}
                      >
                        ›
                      </button>
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                {COLOUR_PARTS.map((label, part) => (
                  <div key={label} className={styles.colourRow}>
                    <span className={styles.colourLabel}>
                      {label}
                      {HEAD_COLOURS.has(part) ? "" : " *"}
                    </span>
                    <span className={styles.swatches}>
                      {wearables.palettes[part].map((rgb, colour) => (
                        <button
                          key={colour}
                          type="button"
                          className={styles.swatch}
                          style={{ background: swatchCss(rgb) }}
                          aria-pressed={draft.look.colours[part] === colour}
                          aria-label={`${label} colour ${colour + 1}`}
                          onClick={() => setColour(part, colour)}
                        />
                      ))}
                    </span>
                  </div>
                ))}
                <p className={styles.hint}>* not shown on the chathead</p>
              </>
            )}
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <label className={styles.name}>
          Name{" "}
          <input
            type="text"
            value={draft.name}
            maxLength={OUTFIT_NAME_MAX}
            onChange={(event) => {
              const name = event.target.value;
              edit((outfit) => ({ ...outfit, name }));
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={!check.ok || (!dirty && isSaved)}
          aria-disabled={busy || undefined}
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => void saveAndWear()}
          disabled={!check.ok || (!dirty && isSaved && wearing)}
          aria-disabled={busy || undefined}
        >
          Save and wear
        </button>
        <button type="button" onClick={() => void remove()} disabled={!isSaved} aria-disabled={busy || undefined}>
          Delete
        </button>
        {store.importLook ? (
          <button type="button" onClick={() => void importLook()} aria-disabled={busy || undefined}>
            Import from game
          </button>
        ) : null}
      </div>

      <p className={styles.status} role="status">
        {editorStatusText({ checkError: check.ok ? null : check.error, status, dirty })}
      </p>
    </div>
  );
}
