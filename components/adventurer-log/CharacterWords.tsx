"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { followMove, followRemove, moved, pageAfterRemove } from "@/lib/adventurer-log/character-draft";
import { type DialoguePage, type Persona, PERSONA_LIMITS } from "@/lib/adventurer-log/persona";
import { checkWordsInput, type WordsInput } from "@/lib/adventurer-log/persona-input";
import type { Look } from "@/lib/chathead/look";
import { type Emote, EMOTE_NAMES, EMOTES } from "@/lib/chathead/vocab";
import type { ClanOf } from "@/lib/clans/queries";

import styles from "./Character.module.css";
import CharacterTabs from "./CharacterTabs";
import CharacterWorkspace from "./CharacterWorkspace";
import PageRow from "./PageRow";
import { usePersonaStage } from "./PersonaStage";
import { useTabDraft } from "./useTabDraft";

const NEW_PAGE: DialoguePage = { mood: "neutral", emote: null, lines: [""], colour: 0, effect: 0 };

/**
 * Character › Words: what the adventurer says - the dialogue as rows
 * (`PageRow`), each page's emote, mood, lines and overhead look together,
 * the way it plays - with one Save (`/api/adventurer-log/persona/words`,
 * `{ signatureEmote, dialogue }`). There is no headline: page 1's first line
 * is the greeting, and each page is said overhead in its own colour and
 * effect. Choosing a row plays it on the stage beside it. With no pages, the
 * one signature emote.
 *
 * The browser checks the draft as the server will (`checkWordsInput`); the
 * database has the last word, and draws a mute's line: picks may change,
 * words may not.
 *
 * The stage is never reset from here: the rows choose its page (`goTo`),
 * and it clamps a page that has gone. The tab stays mounted throughout, so
 * after a Remove the focus moves to the page that took the removed one's
 * place.
 */
export default function CharacterWords({
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
  /** The saved persona: what the card draws around the words being edited. */
  persona: Persona;
  initial: WordsInput;
  outfitLook: Look | null;
  headLook: Look | null;
  /** The owner's clan and rank, for the stage card's Clan row; null for none. */
  clan: ClanOf | null;
}) {
  const { draft, set, dirty, busy, message, refused, marked, save } = useTabDraft(
    initial,
    "/api/adventurer-log/persona/words",
    checkWordsInput,
  );
  // A key per page that follows it when it moves, so a row keeps its focus
  // and caret through a reorder.
  const [pageKeys, setPageKeys] = useState(() => initial.dialogue.map((_, index) => index));
  const pageCount = draft.dialogue.length;
  const shown = useMemo<Persona>(
    () => ({ ...persona, signatureEmote: draft.signatureEmote, dialogue: draft.dialogue }),
    [persona, draft],
  );

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
    set("dialogue", [...draft.dialogue, NEW_PAGE]);
    setPageKeys([...pageKeys, Math.max(-1, ...pageKeys) + 1]);
  }

  return (
    <CharacterWorkspace
      name={name}
      username={username}
      joinedAt={joinedAt}
      persona={shown}
      outfitLook={outfitLook}
      headLook={headLook}
      clan={clan}
    >
      <CharacterTabs current="words" />
      <form onSubmit={save} className={styles.form}>
        <fieldset className={styles.section}>
          <legend>Dialogue</legend>
          <p className={styles.hint}>
            Each page is one beat: what your figure does, the face you say it with, the words, and how they look
            above your head. Visitors click to continue, and your figure says each line as they read it. Up to{" "}
            {PERSONA_LIMITS.pages} pages; click one, or type in it, to see your card play it.
          </p>
          <DialogueRows
            dialogue={draft.dialogue}
            pageKeys={pageKeys}
            name={name}
            outfitLook={outfitLook}
            headLook={headLook}
            invalid={marked("dialogue") ?? false}
            onChange={setPage}
            onMove={movePage}
            onRemove={removePage}
            onAdd={addPage}
          />
          <p className={styles.hint}>
            The in-game way works too: start a line with <code>glow1:wave:</code> and it sets that page&rsquo;s
            overhead look.
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

/**
 * The rows, and "Add a page". Inside the stage, so that adding, moving or
 * removing a page keeps the stage on the page it was playing
 * (`followMove`, `followRemove`): the added page is chosen and played, a
 * moved one is followed, and a removed one gives way to the page in its
 * place. Following only moves the stage (`goTo(…, { play: false })`); it
 * does not replay an emote nobody asked for.
 */
function DialogueRows({
  dialogue,
  pageKeys,
  name,
  outfitLook,
  headLook,
  invalid,
  onChange,
  onMove,
  onRemove,
  onAdd,
}: {
  dialogue: readonly DialoguePage[];
  pageKeys: readonly number[];
  name: string;
  outfitLook: Look | null;
  headLook: Look | null;
  invalid: boolean;
  onChange(index: number, page: DialoguePage): void;
  onMove(index: number, by: -1 | 1): void;
  onRemove(index: number): void;
  onAdd(): void;
}) {
  const stage = usePersonaStage();
  const count = dialogue.length;
  const pagesRef = useRef<HTMLOListElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  // Which page takes the focus once a Remove has rendered (`pageAfterRemove`;
  // null is "Add a page"), or undefined when nothing is waiting.
  const refocus = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    if (refocus.current === undefined) return;
    const target = refocus.current;
    refocus.current = undefined;
    const row = target === null ? null : pagesRef.current?.children[target];
    const button = row?.querySelector<HTMLButtonElement>("button[aria-label^='Remove']") ?? addRef.current;
    button?.focus();
  });

  function move(index: number, by: -1 | 1) {
    onMove(index, by);
    const next = followMove(stage.page, count, index, index + by);
    if (next !== stage.page) stage.goTo(next, { play: false });
  }

  function remove(index: number) {
    onRemove(index);
    refocus.current = pageAfterRemove(index, count - 1);
    // The page being played, followed; if it is the one removed, the page in
    // its place becomes current, as its row now shows. Neither plays.
    const next = followRemove(stage.page, index, count - 1);
    if (next !== null && index <= stage.page) stage.goTo(next, { play: false });
  }

  function add() {
    if (count >= PERSONA_LIMITS.pages) return;
    onAdd();
    // One past today's last: the page being added, once it renders.
    stage.goTo(count);
  }

  return (
    <>
      {count > 0 ? (
        <ol ref={pagesRef} className={styles.pages}>
          {dialogue.map((page, index) => (
            <PageRow
              key={pageKeys[index]}
              index={index}
              count={count}
              page={page}
              name={name}
              outfitLook={outfitLook}
              headLook={headLook}
              invalid={invalid}
              onChange={(next) => onChange(index, next)}
              onMove={(by) => move(index, by)}
              onRemove={() => remove(index)}
            />
          ))}
        </ol>
      ) : null}
      <button ref={addRef} type="button" onClick={add} disabled={count >= PERSONA_LIMITS.pages}>
        Add a page
      </button>
      {count >= PERSONA_LIMITS.pages ? (
        <span className={styles.count}> {PERSONA_LIMITS.pages} pages is the most.</span>
      ) : null}
    </>
  );
}
