"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { moved, pageAfterRemove, typeHeadline } from "@/lib/adventurer-log/character-draft";
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
import { useTabDraft } from "./useTabDraft";

const NEW_PAGE: DialoguePage = { mood: "neutral", emote: null, lines: [""] };

/**
 * Character › Words: what the adventurer says - the headline as overhead
 * chat, and the dialogue visitors click through (or, with no pages, the one
 * signature emote) - with one Save (`/api/adventurer-log/persona/words`).
 * The stage beside it draws the draft as it is typed. The browser checks
 * the draft as the server will (`checkWordsInput`); the database has the
 * last word, and draws a mute's line: picks may change, words may not.
 *
 * Adding or removing a page starts the stage's conversation again
 * (`resetKey`), without remounting the tab: focus stays on "Add a page", and
 * after a Remove it moves to the page that took the removed one's place.
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
  const { draft, change, set, dirty, busy, message, refused, marked, save } = useTabDraft(
    initial,
    "/api/adventurer-log/persona/words",
    checkWordsInput,
  );
  // A key per page that follows it when it moves, so a page's textarea
  // keeps its focus and caret through a reorder.
  const [pageKeys, setPageKeys] = useState(() => initial.dialogue.map((_, index) => index));
  const headlineId = useId();
  const headlineCountId = useId();
  const pagesRef = useRef<HTMLOListElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  // Which page takes the focus once a Remove has rendered (`pageAfterRemove`;
  // null is "Add a page"), or undefined when nothing is waiting.
  const refocus = useRef<number | null | undefined>(undefined);
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

  useEffect(() => {
    if (refocus.current === undefined) return;
    const target = refocus.current;
    refocus.current = undefined;
    const card = target === null ? null : pagesRef.current?.children[target];
    const button = card?.querySelector<HTMLButtonElement>("button[aria-label^='Remove']") ?? addRef.current;
    button?.focus();
  });

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
    refocus.current = pageAfterRemove(index, pageCount - 1);
  }

  function addPage() {
    if (pageCount >= PERSONA_LIMITS.pages) return;
    set("dialogue", [...draft.dialogue, NEW_PAGE]);
    setPageKeys([...pageKeys, Math.max(-1, ...pageKeys) + 1]);
  }

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
      resetKey={pageCount}
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
            <ol ref={pagesRef} className={styles.pages}>
              {draft.dialogue.map((page, index) => (
                <PageCard
                  key={pageKeys[index]}
                  index={index}
                  count={pageCount}
                  page={page}
                  invalid={marked("dialogue") ?? false}
                  onChange={(next) => setPage(index, next)}
                  onMove={(by) => movePage(index, by)}
                  onRemove={() => removePage(index)}
                />
              ))}
            </ol>
          ) : null}
          <button ref={addRef} type="button" onClick={addPage} disabled={pageCount >= PERSONA_LIMITS.pages}>
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
