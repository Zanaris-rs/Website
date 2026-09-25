import type { ReactNode } from "react";

import Chathead from "@/components/game/Chathead";
import SkillIcon from "@/components/game/SkillIcon";
import { formatMonth } from "@/lib/adventurer-log/format";
import type { WardrobeOutfit } from "@/lib/adventurer-log/wardrobe";
import type { LogHeader } from "@/lib/adventurer-log/queries";
import type { TimelinePage } from "@/lib/adventurer-log/view";
import type { PlayerSkill } from "@/lib/hiscores/api";
import { CATEGORIES } from "@/lib/hiscores/categories";
import { statOfCategory } from "@/lib/skills/icons";

import styles from "./Log.module.css";
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
  bar,
  viewer,
  css,
  outfits = [],
}: {
  header: LogHeader & { result: "ok" };
  name: string;
  skills: readonly PlayerSkill[];
  first: TimelinePage;
  bar?: ReactNode;
  /** Who is reading, when someone signed in is. */
  viewer: TimelineViewer | null;
  /** The owner's stylesheet, already through `sanitizeCss`; empty for none. */
  css: string;
  /** The owner's saved outfits, for the Wardrobe; none hides it. */
  outfits?: readonly WardrobeOutfit[];
}) {
  const levels = new Map(skills.map((skill) => [skill.category, skill.level]));

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

            <section className="al-stats al-box">
              <h2>Skills</h2>
              <div className="al-box-body">
                {skills.length === 0 ? (
                  <p className="al-empty">Not on the hiscores yet.</p>
                ) : (
                  <table>
                    <tbody>
                      {CATEGORIES.filter((category) => levels.has(category.id)).map((category) => (
                        <tr key={category.id} className={`al-skill al-skill--${category.id}`}>
                          <td>
                            <SkillIcon stat={statOfCategory(category.id)} size={16} />
                          </td>
                          <td>{category.name}</td>
                          <td>{levels.get(category.id)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
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
