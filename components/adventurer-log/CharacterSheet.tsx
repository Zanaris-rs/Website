"use client";

import { useMemo } from "react";

import SheetClanRow, { type SheetClan } from "@/components/clans/SheetClanRow";
import { goalsWith, previewPersona } from "@/lib/adventurer-log/character-draft";
import { type God, GOD_NAMES, GODS, type Persona, PERSONA_LIMITS } from "@/lib/adventurer-log/persona";
import { checkSheetInput, type SheetInput } from "@/lib/adventurer-log/persona-input";
import { PLACES } from "@/lib/adventurer-log/places";
import type { Look } from "@/lib/chathead/look";

import styles from "./Character.module.css";
import CharacterTabs from "./CharacterTabs";
import CharacterWorkspace from "./CharacterWorkspace";
import { useTabDraft } from "./useTabDraft";

type WordField = "title" | "examine" | "hangout";

/** The three free-text lines of the sheet, with their limits. */
const WORDS: Record<WordField, { label: string; max: number }> = {
  title: { label: "Title", max: PERSONA_LIMITS.title },
  examine: { label: "Examine", max: PERSONA_LIMITS.examine },
  hangout: { label: "Hangout", max: PERSONA_LIMITS.hangout },
};

/**
 * Character › Sheet: who the adventurer is - title, examine, home town,
 * hangout, god and three goals - with one Save
 * (`/api/adventurer-log/persona/sheet`), the card beside it drawing the
 * draft. The Clan row is read-only (`SheetClanRow`, from `clan_of`): it
 * saves nothing, and membership is the Clan tab's, which it links to.
 */
export default function CharacterSheet({
  name,
  username,
  joinedAt,
  persona,
  initial,
  outfitLook,
  headLook,
  clan,
}: {
  name: string;
  username: string;
  joinedAt: string;
  /** The saved persona: what the card draws around the sheet being edited. */
  persona: Persona;
  initial: SheetInput;
  outfitLook: Look | null;
  headLook: Look | null;
  /** The owner's clan and rank, null when they are in none, or "unavailable" when the read failed. */
  clan: SheetClan;
}) {
  const { draft, set, dirty, busy, message, refused, marked, save } = useTabDraft(
    initial,
    "/api/adventurer-log/persona/sheet",
    checkSheetInput,
  );
  const shown = useMemo(() => previewPersona({ ...persona, ...draft }), [persona, draft]);

  function words(field: WordField) {
    return (
      <label className={styles.row}>
        <span className={styles.label}>{WORDS[field].label}</span>
        <input
          type="text"
          value={draft[field]}
          maxLength={WORDS[field].max}
          aria-invalid={marked(field)}
          onChange={(event) => set(field, event.target.value)}
        />
      </label>
    );
  }

  return (
    <CharacterWorkspace
      name={name}
      username={username}
      joinedAt={joinedAt}
      persona={shown}
      outfitLook={outfitLook}
      headLook={headLook}
      // The stage card is the log's: a failed read draws no Clan row there.
      clan={clan === "unavailable" ? null : clan}
    >
      <CharacterTabs current="sheet" />
      <form onSubmit={save} className={styles.form}>
        <fieldset className={styles.section}>
          <legend>Who you are</legend>
          {words("title")}
          {words("examine")}
          <label className={styles.row}>
            <span className={styles.label}>Home town</span>
            <select
              value={draft.homeTown ?? ""}
              aria-invalid={marked("homeTown")}
              onChange={(event) => set("homeTown", event.target.value || null)}
            >
              <option value="">—</option>
              {PLACES.map((place) => (
                <option key={place.key} value={place.key}>
                  {place.name}
                </option>
              ))}
            </select>
          </label>
          {words("hangout")}
          <label className={styles.row}>
            <span className={styles.label}>God</span>
            <select
              value={draft.god ?? ""}
              aria-invalid={marked("god")}
              onChange={(event) => set("god", (event.target.value || null) as God | null)}
            >
              <option value="">None</option>
              {GODS.map((god) => (
                <option key={god} value={god}>
                  {GOD_NAMES[god]}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.row}>
            <span className={styles.label}>Clan</span>
            <SheetClanRow clan={clan} className={styles.clanRow} />
          </div>
          <div className={styles.row} role="group" aria-label="Goals">
            <span className={styles.label} aria-hidden="true">
              Goals
            </span>
            <div className={styles.goals}>
              {Array.from({ length: PERSONA_LIMITS.goals }, (_, index) => (
                <input
                  key={index}
                  type="text"
                  aria-label={`Goal ${index + 1}`}
                  value={draft.goals[index] ?? ""}
                  maxLength={PERSONA_LIMITS.goal}
                  aria-invalid={marked("goals")}
                  onChange={(event) => set("goals", goalsWith(draft.goals, index, event.target.value))}
                />
              ))}
            </div>
          </div>
        </fieldset>
        <p className={styles.hint}>Where your figure stands, and which way it faces, are on the Look tab.</p>

        <div className={styles.save}>
          <button type="submit" disabled={!dirty} aria-disabled={busy || undefined}>
            Save
          </button>
          <span role="status" className={refused ? styles.error : undefined}>
            {message}
          </span>
        </div>
      </form>
    </CharacterWorkspace>
  );
}
