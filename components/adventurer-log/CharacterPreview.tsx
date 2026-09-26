"use client";

import "@/components/game/game-fonts.css";

import { useMemo } from "react";

import { previewPersona } from "@/lib/adventurer-log/character-draft";
import { dialoguePages } from "@/lib/adventurer-log/dialogue";
import type { PersonaInput } from "@/lib/adventurer-log/persona-input";
import type { Look } from "@/lib/chathead/look";

import Card from "./Card";
import styles from "./CharacterEditor.module.css";
import DialogueBox from "./DialogueBox";
import logStyles from "./Log.module.css";
import PersonaStage, { usePersonaStage } from "./PersonaStage";

/**
 * The Character tab's preview: the log's own card and dialogue box, in the
 * log's own markup, drawing the unsaved draft - as `LogView` draws the saved
 * one. The looks are passed through untouched: `Chathead` restarts its mood
 * whenever its look is a new object, so a look rebuilt per render would
 * restart it on every keystroke.
 */
export default function CharacterPreview({
  draft,
  name,
  username,
  joinedAt,
  outfitLook,
  headLook,
}: {
  draft: PersonaInput;
  name: string;
  username: string;
  joinedAt: string;
  outfitLook: Look | null;
  headLook: Look | null;
}) {
  const persona = useMemo(() => previewPersona(draft), [draft]);
  const pages = dialoguePages(persona, draft.headline);
  // As on the log: the signature emote stands in only when there are no pages.
  const signatureEmote = draft.dialogue.length === 0 ? draft.signatureEmote : null;

  return (
    // Keyed by the page count, so adding or removing a page starts the
    // conversation again from its first page, emote and all.
    <PersonaStage key={pages.length} pages={pages} signatureEmote={signatureEmote}>
      <div className={`al-root ${logStyles.root}`}>
        <div className="al-page">
          <aside className="al-side">
            <Card
              name={name}
              username={username}
              joinedAt={joinedAt}
              headline={draft.headline}
              persona={persona}
              outfitLook={outfitLook}
              headLook={headLook}
              viewerIsOwner={false}
            />
          </aside>
          <div className="al-main">
            <DialogueBox name={name} look={headLook} pages={pages} />
          </div>
        </div>
      </div>
      <Pager />
    </PersonaStage>
  );
}

/** Back and forward through the pages, outside the log's markup. */
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
