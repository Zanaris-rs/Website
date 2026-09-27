"use client";

import { type FormEvent, useId, useRef, useState } from "react";

import Tile from "@/components/site/Tile";
import {
  BAD_FIELDS,
  goalsWith,
  moved,
  SAVE_MESSAGES,
  typeHeadline,
} from "@/lib/adventurer-log/character-draft";
import { send } from "@/lib/adventurer-log/client";
import { HEADLINE_MAX } from "@/lib/adventurer-log/format";
import {
  type DialoguePage,
  type God,
  GOD_NAMES,
  GODS,
  PERSONA_LIMITS,
  PLAYSTYLE_NAMES,
  PLAYSTYLES,
} from "@/lib/adventurer-log/persona";
import { checkPersonaInput, type PersonaInput } from "@/lib/adventurer-log/persona-input";
import { PLACES } from "@/lib/adventurer-log/places";
import type { Look } from "@/lib/chathead/look";
import { type Emote, EMOTE_NAMES, EMOTES } from "@/lib/chathead/vocab";
import { SCENES, sceneOf, sceneSrc } from "@/lib/scenes/spots";

import styles from "./CharacterEditor.module.css";
import CharacterPreview from "./CharacterPreview";
import ColourPicker from "./ColourPicker";
import PageCard from "./PageCard";

type Field = keyof PersonaInput;
type WordField = "title" | "examine" | "hangout" | "clan";
type Status = { kind: "saved" } | { kind: "error"; message: string } | null;

const NEW_PAGE: DialoguePage = { mood: "neutral", emote: null, lines: [""] };

/** The four free-text lines of "Who you are", with their limits. */
const WORDS: Record<WordField, { label: string; max: number }> = {
  title: { label: "Title", max: PERSONA_LIMITS.title },
  examine: { label: "Examine", max: PERSONA_LIMITS.examine },
  hangout: { label: "Hangout", max: PERSONA_LIMITS.hangout },
  clan: { label: "Clan", max: PERSONA_LIMITS.clan },
};

/**
 * The Character tab: everything the log's card and dialogue box draw about
 * the owner, in the spec's four sections, with one Save for the lot, and the
 * card and dialogue box themselves beside it drawing the draft as it is
 * typed. The browser checks the draft as the server will
 * (`checkPersonaInput`), so a mistake gets a sentence before a round trip;
 * the database still has the last word, and a mute's line - picks may
 * change, words may not - is drawn there.
 */
export default function CharacterEditor({
  initial,
  name,
  username,
  joinedAt,
  outfitLook,
  headLook,
}: {
  initial: PersonaInput;
  name: string;
  username: string;
  joinedAt: string;
  /** The default outfit, or null: the only look ever drawn whole. */
  outfitLook: Look | null;
  /** The log header's look, for the chatheads. */
  headLook: Look | null;
}) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  // A key per page that follows it when it moves, so a page's textarea
  // keeps its focus and caret through a reorder.
  const [pageKeys, setPageKeys] = useState(() => initial.dialogue.map((_, index) => index));
  const nextKey = useRef(initial.dialogue.length);
  const [status, setStatus] = useState<Status>(null);
  const [invalid, setInvalid] = useState<readonly Field[]>([]);
  const [busy, setBusy] = useState(false);
  const headlineId = useId();
  const headlineCountId = useId();

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const marked = (field: Field) => invalid.includes(field) || undefined;
  const pageCount = draft.dialogue.length;
  // A figure needs a saved outfit, and a scene needs a figure.
  const canStand = outfitLook !== null;
  const homeScene = sceneOf(draft.homeTown);

  function change(next: PersonaInput) {
    setDraft(next);
    setStatus(null);
    setInvalid([]);
  }

  function set<K extends Field>(key: K, value: PersonaInput[K]) {
    change({ ...draft, [key]: value });
  }

  function setPage(index: number, page: DialoguePage) {
    set("dialogue", draft.dialogue.map((current, i) => (i === index ? page : current)));
  }

  function movePage(index: number, by: -1 | 1) {
    set("dialogue", moved(draft.dialogue, index, index + by));
    setPageKeys(moved(pageKeys, index, index + by));
  }

  function removePage(index: number) {
    set("dialogue", draft.dialogue.filter((_, i) => i !== index));
    setPageKeys(pageKeys.filter((_, i) => i !== index));
  }

  function addPage() {
    if (pageCount >= PERSONA_LIMITS.pages) return;
    set("dialogue", [...draft.dialogue, NEW_PAGE]);
    setPageKeys([...pageKeys, nextKey.current++]);
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
    const checked = checkPersonaInput(draft);
    if (!checked.ok) {
      setStatus({ kind: "error", message: checked.error });
      return;
    }
    setBusy(true);
    const sent = draft;
    const result = await send("/api/adventurer-log/persona", checked.value, "POST", SAVE_MESSAGES);
    setBusy(false);
    if (!result.ok) {
      setStatus({ kind: "error", message: result.message });
      setInvalid(BAD_FIELDS[result.code] ?? []);
      return;
    }
    // What was checked is what the server saved (trimmed, blank goals and
    // trailing blank lines gone); the draft becomes it unless it has moved on.
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
    <form onSubmit={save} className={styles.editor}>
      <div className={styles.form}>
        <fieldset className={styles.section}>
          <legend>Overhead chat</legend>
          {/* The count sits outside the label, as a description: in the label it
              would be part of the field's name, and change with every key. */}
          <div className={styles.row}>
            <span className={styles.label}>
              <label htmlFor={headlineId}>Headline</label>{" "}
              <span id={headlineCountId} className={styles.count}>
                {draft.headline.length}/{HEADLINE_MAX}
              </span>
            </span>
            <input
              id={headlineId}
              type="text"
              value={draft.headline}
              maxLength={HEADLINE_MAX}
              aria-describedby={headlineCountId}
              aria-invalid={marked("headline")}
              onChange={(event) => change(typeHeadline(draft, event.target.value))}
            />
          </div>
          <ColourPicker
            colour={draft.colour}
            effect={draft.effect}
            onColour={(colour) => set("colour", colour)}
            onEffect={(effect) => set("effect", effect)}
          />
          <p className={styles.hint}>
            Or type it the in-game way: <code>glow1:wave:Selling lobbies</code> picks the colour and effect for
            you.
          </p>
        </fieldset>

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
          {homeScene && canStand ? (
            <div className={styles.standHere}>
              <button
                type="button"
                disabled={draft.scene === homeScene.key}
                onClick={() => set("scene", homeScene.key)}
              >
                Stand here
              </button>
              <span className={styles.hint}>
                {draft.scene === homeScene.key
                  ? `Your figure stands at ${homeScene.name}.`
                  : `Put your figure at ${homeScene.name}.`}
              </span>
            </div>
          ) : null}
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
          {words("clan")}
          <label className={styles.row}>
            <span className={styles.label}>Playstyle</span>
            <select
              value={draft.playstyle ?? ""}
              aria-invalid={marked("playstyle")}
              onChange={(event) => set("playstyle", event.target.value || null)}
            >
              <option value="">—</option>
              {PLAYSTYLES.map((style) => (
                <option key={style} value={style}>
                  {PLAYSTYLE_NAMES[style]}
                </option>
              ))}
            </select>
          </label>
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

        <fieldset className={styles.section}>
          <legend>Where you stand</legend>
          <div className={styles.scenes} role="group" aria-label="Scene">
            <button
              type="button"
              className={styles.scene}
              aria-pressed={draft.scene === null}
              disabled={!canStand}
              onClick={() => set("scene", null)}
            >
              <span className={`${styles.thumb} ${styles.noScene}`} aria-hidden="true" />
              <span className={styles.sceneName}>No scene</span>
            </button>
            {SCENES.spots.map((spot) => (
              <button
                key={spot.key}
                type="button"
                className={styles.scene}
                aria-pressed={draft.scene === spot.key}
                disabled={!canStand}
                onClick={() => set("scene", spot.key)}
              >
                <Tile src={sceneSrc(spot)} width={spot.width / 2} height={spot.height / 2} className={styles.thumb} />
                <span className={styles.sceneName}>{spot.name}</span>
              </button>
            ))}
          </div>
          <p className={styles.hint}>
            {canStand ? "Your figure wears your default outfit." : "Save an outfit to stand in a scene."}{" "}
            <a href="/account/adventurer-log/outfits">{canStand ? "Change it in Outfits" : "Go to Outfits"}</a>.
          </p>
          {pageCount === 0 ? (
            <>
              <label className={styles.row}>
                <span className={styles.label}>Signature emote</span>
                <select
                  value={draft.signatureEmote ?? ""}
                  aria-invalid={marked("signatureEmote")}
                  onChange={(event) => set("signatureEmote", (event.target.value || null) as Emote | null)}
                >
                  <option value="">No emote</option>
                  {EMOTES.map((emote) => (
                    <option key={emote} value={emote}>
                      {EMOTE_NAMES[emote]}
                    </option>
                  ))}
                </select>
              </label>
              <p className={styles.hint}>Your figure acts it out when someone opens your log.</p>
            </>
          ) : (
            <p className={styles.hint}>
              Your figure acts out each page&rsquo;s emote. With no pages, you pick one signature emote here
              instead.
            </p>
          )}
        </fieldset>

        <fieldset className={styles.section}>
          <legend>What you say</legend>
          <p className={styles.hint}>
            Up to {PERSONA_LIMITS.pages} pages that visitors click through, like talking to an NPC. Each line you
            type is a line of the dialogue box: up to {PERSONA_LIMITS.lines} lines of {PERSONA_LIMITS.line}{" "}
            characters. With no pages, your headline fills the dialogue box.
          </p>
          {pageCount > 0 ? (
            <ol className={styles.pages}>
              {draft.dialogue.map((page, index) => (
                <PageCard
                  key={pageKeys[index]}
                  index={index}
                  count={pageCount}
                  page={page}
                  invalid={invalid.includes("dialogue")}
                  onChange={(next) => setPage(index, next)}
                  onMove={(by) => movePage(index, by)}
                  onRemove={() => removePage(index)}
                />
              ))}
            </ol>
          ) : null}
          <button type="button" onClick={addPage} disabled={pageCount >= PERSONA_LIMITS.pages}>
            Add a page
          </button>
          {pageCount >= PERSONA_LIMITS.pages ? (
            <span className={styles.count}> {PERSONA_LIMITS.pages} pages is the most.</span>
          ) : null}
        </fieldset>
      </div>

      <section className={styles.preview} aria-label="Preview">
        <h2 className={styles.previewTitle}>Preview</h2>
        <p className={styles.hint}>Your card and dialogue box as they will look once you save.</p>
        <CharacterPreview
          draft={draft}
          name={name}
          username={username}
          joinedAt={joinedAt}
          outfitLook={outfitLook}
          headLook={headLook}
        />
      </section>

      <div className={styles.save}>
        <button type="submit" disabled={busy || !dirty}>
          Save your character
        </button>
        <span role="status" className={status?.kind === "error" ? styles.error : undefined}>
          {message}
        </span>
      </div>
    </form>
  );
}

