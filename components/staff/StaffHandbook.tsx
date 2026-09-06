import account from "@/components/account/Account.module.css";
import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import type { Handbook } from "@/lib/staff/handbook";
import { staffLinks } from "@/lib/staff/links";

import styles from "./Handbook.module.css";

/**
 * The moderation handbook: ten Markdown sections from `content/staff`, in one
 * document, behind the staff gate.
 *
 * One page and not ten, with a contents list of in-page anchors, because the
 * question a moderator has — "how long is the automatic ban?" — is answered by
 * `ctrl+F` far more often than by navigation, and a book split across ten URLs
 * cannot be searched at all. The anchors are plain `<a href="#slug">`, like
 * every other link in this chrome.
 *
 * The bodies are Markdown rendered on the server and injected as HTML. This is
 * the second `dangerouslySetInnerHTML` on the site, and the second one for the
 * same reason: `lib/staff/handbook.ts` explains the waiver, and
 * `lib/staff/handbook-content.test.ts` refuses a `<script` in a committed
 * section so that the decision cannot be reversed by accident.
 */
export default function StaffHandbook({ handbook }: { handbook: Handbook }) {
  return (
    <>
      <TitleBox
        title="Moderation handbook"
        links={staffLinks("/staff/handbook")}
      />

      <Panel align="left">
        <div className={account.heading}>
          <b>Contents</b>
        </div>

        <ul className={styles.contents}>
          {handbook.contents.map((entry) => (
            <li key={entry.slug}>
              <a className={frame.link} href={`#${entry.slug}`}>
                {entry.title}
              </a>
            </li>
          ))}
        </ul>

        {handbook.sections.map((section) => (
          <section
            key={section.slug}
            id={section.slug}
            className={styles.section}
          >
            <h2 className={styles.title}>{section.title}</h2>
            <div
              className={styles.body}
              dangerouslySetInnerHTML={{ __html: section.html }}
            />
          </section>
        ))}

        <p className={account.note}>
          These pages are Markdown files in the site&apos;s own repository, and
          each one names the engine or website file its numbers came from. If
          something here disagrees with what the game or a staff page actually
          does, the code is right and this is a bug — say so.
        </p>
      </Panel>
    </>
  );
}
