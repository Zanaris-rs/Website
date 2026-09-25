import type { ReactNode } from "react";

import Chathead from "@/components/game/Chathead";
import { formatMonth } from "@/lib/adventurer-log/format";
import type { WardrobeOutfit } from "@/lib/adventurer-log/wardrobe";
import type { Filter } from "@/lib/adventurer-log/filters";
import type { LogHeader } from "@/lib/adventurer-log/queries";
import type { LogRecord } from "@/lib/adventurer-log/records";
import type { PinnedView, TimelinePage } from "@/lib/adventurer-log/view";
import type { PlayerSkill } from "@/lib/hiscores/api";

import styles from "./Log.module.css";
import Records from "./Records";
import Skills from "./Skills";
import Timeline, { type TimelineViewer } from "./Timeline";
import Wardrobe from "./Wardrobe";

/**
 * A player's Adventurer Log: who they are on the left - chathead, headline,
 * skills - and on the right what they say about themselves and what they
 * have been doing. `bar` is the site's own strip above it (the owner's links,
 * later the report button), deliberately outside `.al-root`, where nothing an
 * owner's stylesheet reaches can hide or cover it - which is why the report
 * button for the whole log is there.
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
        <div className="al-page">
          <aside className="al-side">
            <section className="al-header al-box">
              <h1 className="al-title">{name}</h1>
              <div className="al-chathead">
                <Chathead look={header.look} label={`${name}'s chathead`} />
              </div>
              {header.headline ? <p className="al-headline">&ldquo;{header.headline}&rdquo;</p> : null}
              <p className="al-joined">Adventuring since {formatMonth(header.joinedAt)}</p>
              <p className="al-links">
                <a href={`/hiscores/player/${encodeURIComponent(header.username)}`}>Hiscores</a>
                {viewer?.isOwner ? (
                  <>
                    {" - "}
                    <a href="/account/adventurer-log">Edit your log</a>
                  </>
                ) : null}
              </p>
            </section>

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
      </div>
    </>
  );
}
