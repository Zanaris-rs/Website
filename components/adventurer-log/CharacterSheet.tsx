"use client";

import { type FormEvent, useMemo, useState } from "react";

import { useUnsavedGuard } from "@/components/site/useUnsavedGuard";
import {
  BAD_FIELDS,
  type DraftField,
  goalsWith,
  previewPersona,
  SAVE_MESSAGES,
} from "@/lib/adventurer-log/character-draft";
import { send } from "@/lib/adventurer-log/client";
import { CLAN_TAB_HREF } from "@/lib/adventurer-log/href";
import { type God, GOD_NAMES, GODS, type Persona, PERSONA_LIMITS } from "@/lib/adventurer-log/persona";
import { checkSheetInput, type SheetInput } from "@/lib/adventurer-log/persona-input";
import { PLACES } from "@/lib/adventurer-log/places";
import type { Look } from "@/lib/chathead/look";

import styles from "./Character.module.css";
import CharacterTabs from "./CharacterTabs";
import CharacterWorkspace from "./CharacterWorkspace";

type WordField = "title" | "examine" | "hangout";
type Status = { kind: "saved" } | { kind: "error"; message: string } | null;

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
 * draft. The Clan row is read-only: membership is the Clan tab's.
 */
export default function CharacterSheet({
  name,
  username,
  joinedAt,
  headline,
  persona,
  initial,
  outfitLook,
  headLook,
}: {
  name: string;
  username: string;
  joinedAt: string;
  headline: string;
  /** The saved persona: what the card draws around the sheet being edited. */
  persona: Persona;
  initial: SheetInput;
  outfitLook: Look | null;
  headLook: Look | null;
}) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState<Status>(null);
  const [invalid, setInvalid] = useState<readonly DraftField[]>([]);
  const [busy, setBusy] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useUnsavedGuard(dirty);
  const marked = (field: DraftField) => invalid.includes(field) || undefined;
  const shown = useMemo(() => previewPersona({ ...persona, ...draft }), [persona, draft]);

  function set<K extends keyof SheetInput>(key: K, value: SheetInput[K]) {
    setDraft({ ...draft, [key]: value });
    setStatus(null);
    setInvalid([]);
  }

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

  async function save(event: FormEvent) {
    event.preventDefault();
    const checked = checkSheetInput(draft);
    if (!checked.ok) {
      setStatus({ kind: "error", message: checked.error });
      return;
    }
    setBusy(true);
    const sent = draft;
    const result = await send("/api/adventurer-log/persona/sheet", checked.value, "POST", SAVE_MESSAGES);
    setBusy(false);
    if (!result.ok) {
      setStatus({ kind: "error", message: result.message });
      setInvalid(BAD_FIELDS[result.code] ?? []);
      return;
    }
    setSaved(checked.value);
    setDraft((current) => (current === sent ? checked.value : current));
    setStatus({ kind: "saved" });
  }

  const message = busy
    ? "Saving…"
    : status?.kind === "error"
      ? status.message
      : status?.kind === "saved"
        ? "Saved."
        : dirty
          ? "You have unsaved changes."
          : "";

  return (
    <CharacterWorkspace
      name={name}
      username={username}
      joinedAt={joinedAt}
      headline={headline}
      persona={shown}
      outfitLook={outfitLook}
      headLook={headLook}
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
            <span className={styles.clanRow}>
              Not in a clan · <a href={CLAN_TAB_HREF}>Start or join one</a>
            </span>
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
          <button type="submit" disabled={busy || !dirty}>
            Save
          </button>
          <span role="status" className={status?.kind === "error" ? styles.error : undefined}>
            {message}
          </span>
        </div>
      </form>
    </CharacterWorkspace>
  );
}
