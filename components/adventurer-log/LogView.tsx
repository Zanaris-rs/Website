import type { ReactNode } from "react";

import type { Persona } from "@/lib/adventurer-log/persona";
import type { WardrobeOutfit } from "@/lib/adventurer-log/wardrobe";
import type { Filter } from "@/lib/adventurer-log/filters";
import type { LogHeader } from "@/lib/adventurer-log/queries";
import type { LogRecord } from "@/lib/adventurer-log/records";
import type { PinnedView, TimelinePage } from "@/lib/adventurer-log/view";
import type { Look } from "@/lib/chathead/look";
import type { PlayerSkill } from "@/lib/hiscores/api";

import Card from "./Card";
import styles from "./Log.module.css";
import PersonaStage from "./PersonaStage";
import Records from "./Records";
import Skills from "./Skills";
import Timeline, { type TimelineViewer } from "./Timeline";
import Wardrobe from "./Wardrobe";

/**
 * A player's Adventurer Log: who they are on the left - the character card
 * (name, title, figure or chathead acting out their persona, examine line
 * and sheet), skills - and on the right what they say about themselves and
 * what they have been doing. `bar` is the site's own strip above it (the
 * owner's links, later the report button), deliberately outside `.al-root`,
 * where nothing an owner's stylesheet reaches can hide or cover it - which
 * is why the report button for the whole log is there.
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
}: {
  header: LogHeader & { result: "ok" };
  name: string;
  skills: readonly PlayerSkill[];
  first: TimelinePage;
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
  /** The owner's saved outfits, for the Wardrobe; none hides it. */
  outfits?: readonly WardrobeOutfit[];
  /** The owner's best Overall gain per record length; none hides the box. */
  records?: readonly LogRecord[];
}) {
  return (
    <>
      {bar ? <div className={styles.bar}>{bar}</div> : null}
      <div className={`al-root ${styles.root}`}>
        {/* A plain <style>, drawn where it is and gone when the page is: React
            hoists only a <style> with href and precedence. Its text is the
            sanitiser's output, which has no "<" in it. */}
        {css ? <style>{css}</style> : null}
        <PersonaStage pages={persona.dialogue} signatureEmote={persona.signatureEmote}>
          <div className="al-page">
            <aside className="al-side">
              <Card
                name={name}
                username={header.username}
                joinedAt={header.joinedAt}
                headline={header.headline}
                persona={persona}
                outfitLook={outfitLook}
                headLook={header.look}
                viewerIsOwner={viewer?.isOwner ?? false}
              />

              <Skills username={header.username} skills={skills} />

              <Records records={records} />
            </aside>

            <div className="al-main">
              {header.about ? (
                <section className="al-about al-box">
                  <h2>About {name}</h2>
                  <div className="al-box-body">
                    <p>{header.about}</p>
                  </div>
                </section>
              ) : null}

              <Wardrobe name={name} outfits={outfits} />

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
            </div>
          </div>
        </PersonaStage>
      </div>
    </>
  );
}
