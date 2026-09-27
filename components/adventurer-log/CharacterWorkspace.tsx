"use client";

import "@/components/game/game-fonts.css";

import type { ReactNode } from "react";

import { dialoguePages } from "@/lib/adventurer-log/dialogue";
import type { Persona } from "@/lib/adventurer-log/persona";
import { nearestFacing } from "@/lib/chathead/facing";
import type { Look } from "@/lib/chathead/look";
import { sceneOf } from "@/lib/scenes/spots";

import Card from "./Card";
import styles from "./Character.module.css";
import DialogueBox from "./DialogueBox";
import logStyles from "./Log.module.css";
import PersonaStage from "./PersonaStage";

/**
 * One Character tab: on the left, the stage - the log's own card and
 * dialogue box, in the log's own markup, drawing `persona` as visitors will
 * see it once saved - and on the right, the tab (`children`). Both sit in
 * one `PersonaStage`, so a tab can drive the stage (turn it, read its
 * facing, play a page) and `below` can put controls under the card.
 *
 * `resetKey` starts the stage afresh when it changes (`PersonaStage`): the
 * Words tab passes the page count (a new conversation from its first page),
 * the Look tab the scene (the saved facing, or the nearest the scene
 * allows). It is not a React `key`: the tab beside the stage stays mounted,
 * so the control just pressed keeps its focus.
 *
 * The looks are passed through untouched: `Chathead` and `Figure` redraw
 * whenever a look is a new object.
 */
export default function CharacterWorkspace({
  name,
  username,
  joinedAt,
  headline,
  persona,
  outfitLook,
  headLook,
  resetKey,
  below,
  children,
}: {
  name: string;
  username: string;
  joinedAt: string;
  headline: string;
  persona: Persona;
  /** The worn outfit: the only look ever drawn whole. */
  outfitLook: Look | null;
  /** The chathead's look: the worn outfit, else the game's head-only look. */
  headLook: Look | null;
  resetKey?: string | number;
  below?: ReactNode;
  children: ReactNode;
}) {
  const pages = dialoguePages(persona, headline);
  // As on the log: the signature emote stands in only when there are no pages.
  const signatureEmote = persona.dialogue.length === 0 ? persona.signatureEmote : null;
  const turns = sceneOf(persona.scene)?.turns ?? null;

  return (
    <PersonaStage
      resetKey={resetKey}
      pages={pages}
      signatureEmote={signatureEmote}
      initialFacing={nearestFacing(persona.facing, turns)}
      turns={turns}
    >
      <div className={styles.workspace}>
        <section className={styles.stage} aria-label="Your card, as visitors see it">
          <div className={`al-root ${logStyles.root}`}>
            <div className="al-page">
              <aside className="al-side">
                <Card
                  name={name}
                  username={username}
                  joinedAt={joinedAt}
                  headline={headline}
                  persona={persona}
                  outfitLook={outfitLook}
                  headLook={headLook}
                  viewerIsOwner={false}
                />
              </aside>
              <div className="al-main">
                <DialogueBox name={name} look={headLook} pages={pages} live={false} />
              </div>
            </div>
          </div>
          {below}
        </section>
        <div className={styles.panel}>{children}</div>
      </div>
    </PersonaStage>
  );
}
