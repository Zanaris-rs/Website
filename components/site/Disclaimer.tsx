import {
  GAME_VERSION,
  JAGEX_URL,
  LOSTCITY_DISCORD_URL,
  LOSTCITY_FORUMS_URL,
  LOSTCITY_SITE_URL,
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
 * and nothing for sale — and, because it is their work, where to go if you
 * want to help.
 *
 * `/disclaimer` renders the same component with a way back to the main menu.
 */
export default function Disclaimer({ menuLink }: { menuLink: boolean }) {
  return (
    <>
      <TitleBox title="Non-Affiliation Disclaimer" menu={menuLink} />

      <Panel align="left" className={styles.disclaimerPanel}>
        <div className={styles.lead}>
          This is a{" "}
          <b className={colourClass.green}>
            free, open-source, community-run project
          </b>
          , with the goal of preserving a moment in time for posterity.
        </div>

        <p>
          {SITE_NAME} runs the open-source <b>Lost City</b> server, written from
          scratch by{" "}
          <a href={LOSTCITY_URL} className={frame.linkGreen}>
            the Lost City team
          </a>{" "}
          after many hours of research. We are a rehost of their work, not its
          authors; our fork is at{" "}
          <a href={SOURCE_URL} className={frame.linkGreen}>
            github.com/Zanaris-rs
          </a>{" "}
          and everything you see is transparently open source (MIT).
        </p>

        <p>
          <b className={colourClass.green}>Thank you to the Lost City team.</b>{" "}
          Everything you can play here exists because of their years of research
          and care, and they are still improving it every week. We are grateful
          to be able to stand on their work.
        </p>

        <p>
          If you want to help, the Lost City project is where the work happens
          and where contributions belong, not here:
        </p>
        <div className={styles.linkRow}>
          <a href={LOSTCITY_SITE_URL} className={frame.linkGreen}>
            Lost City website
          </a>
          <a href={LOSTCITY_URL} className={frame.linkGreen}>
            Source code on GitHub
          </a>
          <a href={LOSTCITY_DISCORD_URL} className={frame.linkGreen}>
            Discord
          </a>
          <a href={LOSTCITY_FORUMS_URL} className={frame.linkGreen}>
            Forums
          </a>
        </div>
        <p>
          Our own repositories hold only the changes needed to run this rehost.
        </p>

        <p>
          {SITE_NAME} is not affiliated with, endorsed by, or authorized by{" "}
          <a href={JAGEX_URL} className={frame.linkGreen}>
            Jagex Ltd.
          </a>{" "}
          RuneScape and the game assets are the property of Jagex Ltd.
        </p>

        <p>
          <b className={colourClass.red}>
            You <em>cannot</em> play Old School RuneScape here, buy RuneScape
            gold, or access any of the official game&apos;s services!
          </b>
        </p>

        <p>
          <b className={colourClass.red}>
            As a reminder: never use the same passwords between any online
            service.
          </b>
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
          <StoneButton href={LOSTCITY_SITE_URL} variant="grey">
            Lost City
          </StoneButton>
          <StoneButton href={SOURCE_URL} variant="grey">
            Our Fork
          </StoneButton>
        </div>
      </Panel>
    </>
  );
}
