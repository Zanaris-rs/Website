"use client";

import { useState } from "react";

import Chathead from "@/components/game/Chathead";
import Figure from "@/components/game/Figure";
import type { Look } from "@/lib/chathead/look";
import type { OutfitStore, SavedOutfits } from "@/lib/chathead/outfit-store";
import {
  checkOutfit,
  defaultLook,
  kitChoices,
  OUTFIT_NAME_MAX,
  OUTFIT_SLOTS,
  type Outfit,
} from "@/lib/chathead/validate";
import { swatchCss, wearables } from "@/lib/chathead/wearables";

import ItemPicker from "./ItemPicker";
import styles from "./Outfits.module.css";
import WornTab from "./WornTab";

/**
 * Fashionscape: up to ten outfits, each a look — body, colours, and anything
 * the game lets you wear — with its chathead and its figure drawn live as you
 * change it. One outfit is the default, and its chathead is the player's
 * picture.
 *
 * The chathead shows the head, so only the hat, the hair and jaw, and the
 * hair and skin colours change it; the figure beside it is the whole body,
 * standing as the world shows it, and shows everything.
 */

const COLOUR_PARTS = ["Hair", "Torso", "Legs", "Feet", "Skin"] as const;
/** Which colours the chathead shows: hair (and beard) and skin. */
const HEAD_COLOURS = new Set([0, 4]);

function fresh(slot: number): Outfit {
  return { name: `Outfit ${slot + 1}`, look: defaultLook(0) };
}

function withLook(outfit: Outfit, change: (look: Look) => Partial<Look>) {
  return { ...outfit, look: { ...outfit.look, ...change(outfit.look) } };
}

export default function OutfitEditor({
  initial,
  store,
}: {
  initial: SavedOutfits;
  store: OutfitStore;
}) {
  const [saved, setSaved] = useState(initial);
  const [slot, setSlot] = useState(initial.defaultSlot ?? 0);
  const [draft, setDraft] = useState<Outfit>(
    initial.outfits[initial.defaultSlot ?? 0] ?? fresh(initial.defaultSlot ?? 0),
  );
  const [dirty, setDirty] = useState(false);
  const [picking, setPicking] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const isSaved = saved.outfits[slot] !== null;
  const check = checkOutfit(draft);

  /** Every change goes through the previous draft, so quick clicks add up. */
  function edit(change: (outfit: Outfit) => Outfit) {
    setDraft(change);
    setDirty(true);
    setStatus(null);
  }

  function open(next: number) {
    if (next === slot) return;
    if (dirty && !window.confirm("Discard the changes to this outfit?")) return;
    setSlot(next);
    setDraft(saved.outfits[next] ?? fresh(next));
    setDirty(false);
    setPicking(null);
    setStatus(null);
  }

  async function run(action: () => Promise<SavedOutfits>, done: string) {
    setBusy(true);
    setStatus(null);
    try {
      const next = await action();
      setSaved(next);
      setStatus(done);
      return next;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Something went wrong.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!check.ok) return;
    const next = await run(() => store.save(slot, check.outfit), "Saved.");
    if (next) {
      setDraft(check.outfit);
      setDirty(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${saved.outfits[slot]?.name}"?`)) return;
    const next = await run(() => store.remove(slot), "Deleted.");
    if (next) {
      setDraft(fresh(slot));
      setDirty(false);
    }
  }

  async function importLook() {
    if (!store.importLook) return;
    setBusy(true);
    setStatus(null);
    try {
      const look = await store.importLook();
      if (look) {
        edit((outfit) => ({ ...outfit, look }));
        setStatus("Imported your look from your last save. Save to keep it.");
      } else {
        setStatus(
          "The game has not recorded your look yet. Log in, then log out, and try again.",
        );
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  function setGender(gender: number) {
    if (gender === draft.look.gender) return;
    // The design screen's own behaviour: a new body of the default kits.
    edit((outfit) =>
      withLook(outfit, () => ({ gender, kits: defaultLook(gender).kits })),
    );
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
    setPicking(null);
  }

  const kitRows = [
    { part: 0, label: "Hair" },
    ...(draft.look.gender === 0 ? [{ part: 1, label: "Jaw" }] : []),
  ];

  return (
    <div className={styles.editor}>
      <nav className={styles.slots} aria-label="Outfits">
        {Array.from({ length: OUTFIT_SLOTS }, (_, i) => {
          const outfit = saved.outfits[i];
          return (
            <button
              key={i}
              type="button"
              className={outfit ? styles.slotTab : styles.slotTabEmpty}
              aria-current={i === slot ? "true" : undefined}
              aria-label={`Outfit ${i + 1}: ${outfit ? outfit.name : "empty"}${saved.defaultSlot === i ? ", your picture" : ""}`}
              onClick={() => open(i)}
              title={outfit ? outfit.name : "Empty"}
            >
              {saved.defaultSlot === i ? "★ " : ""}
              {outfit ? outfit.name : `${i + 1}`}
            </button>
          );
        })}
      </nav>

      <div className={styles.workbench}>
        <div className={styles.previews}>
          <figure className={styles.preview}>
            <Chathead look={draft.look} label={`${draft.name}, chathead`} />
            <figcaption>
              {saved.defaultSlot === slot ? "Your picture" : "Chathead"}
            </figcaption>
          </figure>
          <figure className={styles.preview}>
            <Figure look={draft.look} label={`${draft.name}, whole body`} />
            <figcaption>Whole body</figcaption>
          </figure>
        </div>

        <div className={styles.wornColumn}>
          <WornTab
            worn={draft.look.worn}
            picking={picking}
            onPick={(next) => setPicking(picking === next ? null : next)}
          />
          <p className={styles.hint}>Click a slot to wear something.</p>
        </div>

        <div className={styles.design}>
          <fieldset className={styles.field}>
            <legend>Body</legend>
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
          </fieldset>

          <fieldset className={styles.field}>
            <legend>Colours</legend>
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
          </fieldset>
        </div>
      </div>

      {picking !== null ? (
        <ItemPicker
          key={picking}
          slot={picking}
          worn={draft.look.worn[picking] ?? -1}
          onWear={(obj) => wear(picking, obj)}
          onClose={() => setPicking(null)}
        />
      ) : null}

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
          onClick={save}
          disabled={busy || !check.ok || (!dirty && isSaved)}
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => run(() => store.setDefault(slot), "This is now your picture.")}
          disabled={busy || !isSaved || dirty || saved.defaultSlot === slot}
        >
          Use as my picture
        </button>
        <button type="button" onClick={remove} disabled={busy || !isSaved}>
          Delete
        </button>
        {store.importLook ? (
          <button type="button" onClick={importLook} disabled={busy}>
            Import from game
          </button>
        ) : null}
      </div>

      <p className={styles.status} role="status">
        {!check.ok ? check.error : status}
      </p>
    </div>
  );
}
