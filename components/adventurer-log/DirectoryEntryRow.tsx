import styles from "@/components/adventurer-log/Directory.module.css";
import ChatheadFace from "@/components/game/ChatheadFace";
import ChatText from "@/components/game/ChatText";
import ItemIcon from "@/components/game/ItemIcon";
import SkillIcon from "@/components/game/SkillIcon";
import frame from "@/components/site/Frame.module.css";
import type { DirectoryEntry } from "@/lib/adventurer-log/directory";
import { formatWhen } from "@/lib/adventurer-log/format";
import { logHref } from "@/lib/adventurer-log/href";

/**
 * One log in a list of recently active logs: a small chathead, the name and
 * greeting, and what the log last showed. `/adventurers` lists thirty a page
 * and the Community hub's Recent activity five, in the same `<ul>`
 * (`Directory.module.css`'s `logs`).
 */
export default function DirectoryEntryRow({ entry }: { entry: DirectoryEntry }) {
  return (
    <li className={styles.log}>
      <ChatheadFace look={entry.look} size={48} label={`${entry.name}'s chathead`} className={styles.face} />
      <div className={styles.main}>
        <a className={`${frame.link} ${styles.name}`} href={logHref(entry.username)}>
          {entry.name}
        </a>
        {/* The greeting in its colour, as it is said overhead, but still: a list is no place for a wave or a scroll. */}
        {entry.greeting ? (
          <ChatText className={styles.greeting} text={entry.greeting} colour={entry.greetingColour} effect={0} />
        ) : null}
        <div className={styles.activity}>
          {entry.icon ? (
            <span className={styles.icon} aria-hidden>
              {entry.icon.type === "skill" ? (
                <SkillIcon stat={entry.icon.stat} size={20} />
              ) : (
                <ItemIcon id={entry.icon.id} size={20} />
              )}
            </span>
          ) : null}
          <span>{entry.activity}</span>
        </div>
        <time className={styles.time} dateTime={entry.at}>
          {formatWhen(entry.at)}
        </time>
      </div>
    </li>
  );
}
