import {
  GAME_VERSION,
  JAGEX_URL,
  LOSTCITY_URL,
  SITE_NAME,
  SOURCE_URL,
} from "@/lib/site";

import { colourClass } from "./colour";
import frame from "./Frame.module.css";
import Panel from "./Panel";
import styles from "./Site.module.css";
import StoneButton from "./StoneButton";
import TitleBox from "./TitleBox";

/**
 * The front door. `/` is this page, as it is on Lost City, so that anyone who
 * arrives from a link reads what this is before they read anything else: a
 * rehost of somebody else's open-source server, with no connection to Jagex
 * and nothing for sale.
 *
 * `/disclaimer` renders the same component with a way back to the main menu.
 */
export default function Disclaimer({ menuLink }: { menuLink: boolean }) {
  return (
    <>
      <TitleBox title="Non-Affiliation Disclaimer" menu={menuLink} />

      <Panel>
        <div className={styles.lead}>
          <b className={colourClass.green}>
            This is a free, open-source, community-run project, with the goal of
            preserving a moment in time for posterity.
          </b>
        </div>

        <p>
          {SITE_NAME} runs the open-source <b>Lost City</b> server, written from
          scratch by{" "}
          <a href={LOSTCITY_URL} className={frame.link}>
            the Lost City crew
          </a>{" "}
          after many hours of research and peer review. We are a rehost of their
          work, not its authors; our fork is at{" "}
          <a href={SOURCE_URL} className={frame.link}>
            github.com/Zanaris-rs
          </a>{" "}
          and everything you see is transparently open source (MIT).
        </p>

        <p>
          We have not been endorsed by, authorized by, or officially
          communicated with{" "}
          <a href={JAGEX_URL} className={frame.link}>
            Jagex Ltd.
          </a>{" "}
          on our efforts here. The game assets and trademarks belong to Jagex
          Ltd.; RuneScape is a trademark of Jagex Ltd.
        </p>

        <p className={colourClass.red}>
          You <b>cannot</b> play Old School RuneScape here, buy RuneScape gold,
          or access any of the official game&apos;s services!
        </p>

        <p className={colourClass.red}>
          As a reminder: never use the same passwords between any online
          service.
        </p>

        <hr className={styles.rule} />

        <p>
          <b className={colourClass.green}>What version of the game is this?</b>
          <br />
          Currently {GAME_VERSION.date} (revision {GAME_VERSION.revision}).
        </p>

        <p>
          <b className={colourClass.green}>How do I pay for membership?</b>
          <br />
          You don&apos;t! $0/lifetime, this project exists to preserve and share
          history for all. The distinction between &quot;f2p&quot; and
          &quot;p2p&quot; is for historical context and preservation, not for
          profit.
        </p>

        <hr className={styles.rule} />

        <p>
          There are many ways to help if you&apos;re interested! Researching,
          developing, or even sharing your memories with us.
        </p>

        <div className={styles.buttons}>
          <StoneButton href="/title" variant="red">
            I Understand
          </StoneButton>
          <StoneButton href={SOURCE_URL} variant="grey">
            Source Code
          </StoneButton>
        </div>
      </Panel>
    </>
  );
}
