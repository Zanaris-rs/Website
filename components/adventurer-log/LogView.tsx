import type { ReactNode } from "react";

import "@/components/game/game-fonts.css";

import type { Persona } from "@/lib/adventurer-log/persona";
import type { WardrobeOutfit } from "@/lib/adventurer-log/wardrobe";
import type { Filter } from "@/lib/adventurer-log/filters";
import { isPartHidden, type PartKey } from "@/lib/adventurer-log/parts";
import type { LogHeader } from "@/lib/adventurer-log/queries";
import type { LogRecord } from "@/lib/adventurer-log/records";
import type { PinnedView, TimelinePage } from "@/lib/adventurer-log/view";
import { nearestFacing } from "@/lib/chathead/facing";
import type { Look } from "@/lib/chathead/look";
import type { ClanOf } from "@/lib/clans/queries";
import type { PlayerSkill } from "@/lib/hiscores/api";
import { sceneOf } from "@/lib/scenes/spots";

import Card from "./Card";
import DialogueBox from "./DialogueBox";
import styles from "./Log.module.css";
import PersonaStage from "./PersonaStage";
import Records from "./Records";
import Skills from "./Skills";
import Timeline, { type TimelineViewer } from "./Timeline";
import Wardrobe from "./Wardrobe";

/**
 * A player's Adventurer Log: who they are on the left - the character card
 * (name, title, figure or chathead acting out their persona, examine line
 * and sheet), their wardrobe, skills and records - and on the right what they
 * say about themselves and what they have been doing. `bar` is the site's own
 * strip above it (the owner's links, later the report button), deliberately
 * outside `.al-root`, where nothing an owner's stylesheet reaches can hide or
 * cover it - which is why the report button for the whole log is there.
 *
 * The parts its owner hides in Log settings (`header.hiddenParts`,
 * `parts.ts`) are not drawn, for anyone: the dialogue box (the figure still
 * says the pages overhead, moving to the next by itself; with no outfit, the
 * card draws the chathead the box held), the Wardrobe, Records, About, and
 * the timeline with its filters and composer. The card and Skills always are.
 */
export default function LogView({
  header,
  name,
  skills,
  first,
  show,
  pinned,
  bar,
  viewer,
  css,
  persona,
  outfitLook,
  outfits = [],
  records = [],
  clan,
}: {
  header: LogHeader & { result: "ok" };
  name: string;
  skills: readonly PlayerSkill[];
  /** The timeline's first page; null when the owner hides Adventures. */
  first: TimelinePage | null;
  /** The timeline's filter (`?show=`). */
  show: Filter["slug"];
  /** The update pinned to the top, when the filter shows updates. */
  pinned: PinnedView | null;
  bar?: ReactNode;
  /** Who is reading, when someone signed in is. */
  viewer: TimelineViewer | null;
  /** The owner's stylesheet, already through `sanitizeCss`; empty for none. */
  css: string;
  /** The owner's persona: the words and picks the character card draws. */
  persona: Persona;
  /** The default outfit: the only look ever drawn whole, on the card's figure. */
  outfitLook: Look | null;
  /**
   * The owner's saved outfits, for the Wardrobe under the card; none hides
   * it. A reader can try one on when the card draws a figure (`outfitLook`).
   */
  outfits?: readonly WardrobeOutfit[];
  /** The owner's best Overall gain per record length; none hides the box. */
  records?: readonly LogRecord[];
  /** The owner's clan and rank, for the card's Clan row; null for none. */
  clan: ClanOf | null;
}) {
  // One list, so the stage and the dialogue box always agree on what is
  // being said: the stage drives the figure's emote, the box draws the words.
  const pages = persona.dialogue;
  // The signature emote is only a fallback for having no real pages of the
  // owner's own: with real pages, `null` here keeps a page's own "no emote"
  // choice from being papered over by it (PersonaStage's `emote` fallback).
  const signatureEmote = persona.dialogue.length === 0 ? persona.signatureEmote : null;
  // The figure turns through the facings the owner's scene proved (all
  // sixteen with no scene), and opens facing the way the owner keeps (the
  // Look tab's "Face this way"), or the nearest of those facings.
  const turns = sceneOf(persona.scene)?.turns ?? null;
  const hidden = (part: PartKey) => isPartHidden(header.hiddenParts, part);
  return (
    <>
      {bar ? <div className={styles.bar}>{bar}</div> : null}
      <div className={`al-root ${styles.root}`}>
        {/* A plain <style>, drawn where it is and gone when the page is: React
            hoists only a <style> with href and precedence. Its text is the
            sanitiser's output, which has no "<" in it. */}
        {css ? <style>{css}</style> : null}
        <PersonaStage
          pages={pages}
          signatureEmote={signatureEmote}
          initialFacing={nearestFacing(persona.facing, turns)}
          turns={turns}
          autoAdvance={hidden("dialogue")}
        >
          <div className="al-page">
            <aside className="al-side">
              <Card
                name={name}
                username={header.username}
                joinedAt={header.joinedAt}
                persona={persona}
                outfitLook={outfitLook}
                headLook={header.look}
                viewerIsOwner={viewer?.isOwner ?? false}
                outfits={outfits}
                clan={clan}
                chatheadInCard={hidden("dialogue")}
              />

              {hidden("wardrobe") ? null : (
                <Wardrobe name={name} outfits={outfits} interactive={outfitLook !== null} />
              )}

              <Skills username={header.username} skills={skills} />

              {hidden("records") ? null : <Records records={records} />}
            </aside>

            <div className="al-main">
              {hidden("dialogue") ? null : <DialogueBox name={name} look={header.look} pages={pages} />}

              {header.about && !hidden("about") ? (
                <section className="al-about al-box">
                  <h2>About {name}</h2>
                  <div className="al-box-body">
                    <p>{header.about}</p>
                  </div>
                </section>
              ) : null}

              {first && !hidden("adventures") ? (
                <section className="al-timeline al-box">
                  <h2>{name}&rsquo;s Adventurer Log</h2>
                  <div className="al-box-body">
                    <Timeline
                      username={header.username}
                      ownerName={name}
                      ownerLook={header.look}
                      first={first}
                      pinned={pinned}
                      show={show}
                      hiddenCategories={header.hiddenCategories}
                      empty={`${name} has no adventures to show yet.`}
                      viewer={viewer}
                    />
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        </PersonaStage>
      </div>
    </>
  );
}
