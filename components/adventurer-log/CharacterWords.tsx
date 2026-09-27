"use client";

import { type FormEvent, useId, useMemo, useState } from "react";

import { useUnsavedGuard } from "@/components/site/useUnsavedGuard";
import {
  BAD_FIELDS,
  type DraftField,
  moved,
  SAVE_MESSAGES,
  typeHeadline,
} from "@/lib/adventurer-log/character-draft";
import { send } from "@/lib/adventurer-log/client";
import { HEADLINE_MAX } from "@/lib/adventurer-log/format";
import { type DialoguePage, type Persona, PERSONA_LIMITS } from "@/lib/adventurer-log/persona";
import { checkWordsInput, type WordsInput } from "@/lib/adventurer-log/persona-input";
import type { Look } from "@/lib/chathead/look";
import { type Emote, EMOTE_NAMES, EMOTES } from "@/lib/chathead/vocab";

import styles from "./Character.module.css";
import CharacterTabs from "./CharacterTabs";
import CharacterWorkspace from "./CharacterWorkspace";
import ColourPicker from "./ColourPicker";
import PageCard from "./PageCard";
import { usePersonaStage } from "./PersonaStage";

type Status = { kind: "saved" } | { kind: "error"; message: string } | null;

const NEW_PAGE: DialoguePage = { mood: "neutral", emote: null, lines: [""] };

/**
 * Character › Words: what the adventurer says - the headline as overhead
 * chat, and the dialogue visitors click through (or, with no pages, the one
 * signature emote) - with one Save (`/api/adventurer-log/persona/words`).
 * The stage beside it draws the draft as it is typed. The browser checks
 * the draft as the server will (`checkWordsInput`); the database has the
 * last word, and draws a mute's line: picks may change, words may not.
 */
export default function CharacterWords({
  name,
  username,
  joinedAt,
  persona,
  initial,
  outfitLook,
  headLook,
}: {
  name: string;
  username: string;
  joinedAt: string;
  /** The saved persona: what the card draws around the words being edited. */
  persona: Persona;
  initial: WordsInput;
  outfitLook: Look | null;
  headLook: Look | null;
}) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  // A key per page that follows it when it moves, so a page's textarea
  // keeps its focus and caret through a reorder.
  const [pageKeys, setPageKeys] = useState(() => initial.dialogue.map((_, index) => index));
  const [status, setStatus] = useState<Status>(null);
  const [invalid, setInvalid] = useState<readonly DraftField[]>([]);
  const [busy, setBusy] = useState(false);
  const headlineId = useId();
  const headlineCountId = useId();

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useUnsavedGuard(dirty);
  const marked = (field: DraftField) => invalid.includes(field) || undefined;
  const pageCount = draft.dialogue.length;
  const shown = useMemo<Persona>(
    () => ({
      ...persona,
      colour: draft.colour,
      effect: draft.effect,
      signatureEmote: draft.signatureEmote,
      dialogue: draft.dialogue,
    }),
    [persona, draft],
  );

  function change(next: WordsInput) {
    setDraft(next);
    setStatus(null);
    setInvalid([]);
  }

  function set<K extends keyof WordsInput>(key: K, value: WordsInput[K]) {
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
    setPageKeys([...pageKeys, Math.max(-1, ...pageKeys) + 1]);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const checked = checkWordsInput(draft);
    if (!checked.ok) {
      setStatus({ kind: "error", message: checked.error });
      return;
    }
    setBusy(true);
    const sent = draft;
    const result = await send("/api/adventurer-log/persona/words", checked.value, "POST", SAVE_MESSAGES);
    setBusy(false);
    if (!result.ok) {
      setStatus({ kind: "error", message: result.message });
      setInvalid(BAD_FIELDS[result.code] ?? []);
      return;
    }
    // What was checked is what the server saved (trimmed, trailing blank
    // lines gone); the draft becomes it unless it has moved on.
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
      headline={draft.headline}
      persona={shown}
      outfitLook={outfitLook}
      headLook={headLook}
      // Adding or removing a page starts the conversation again from its
      // first page, emote and all.
      stageKey={pageCount}
      below={<Pager />}
    >
      <CharacterTabs current="words" />
      <form onSubmit={save} className={styles.form}>
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

/** Back and forward through the pages, under the stage. */
function Pager() {
  const stage = usePersonaStage();
  if (stage.pageCount < 2) return null;
  return (
    <div className={styles.pager}>
      <button type="button" onClick={stage.prev}>
        ◀ Previous page
      </button>
      <button type="button" onClick={stage.next}>
        Next page ▶
      </button>
    </div>
  );
}
