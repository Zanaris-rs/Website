import type { Metadata } from "next";

import styles from "@/components/rules/Rules.module.css";
import { colourClass } from "@/components/site/colour";
import Frame from "@/components/site/Frame";
import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { RULES_UPDATED, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Rules",
  description:
    "The twelve original rules of conduct, and what they mean on Zanaris.",
};

/**
 * What the twelve rules mean here. The rules themselves are 2004's and live at
 * `/rules/original`; this page is the clarifications a 2004 rules page could
 * not have, because the things it has to rule on did not exist yet.
 */
export default function Rules() {
  return (
    <Frame>
      <TitleBox title="Rules" />

      <Panel align="left">
        <p className={colourClass.red}>
          <b>
            At {SITE_NAME}, players are expected to abide by all 12 of
            Jagex&apos;s{" "}
            <a href="/rules/original" className={colourClass.red}>
              original rules
            </a>
            .
          </b>
        </p>

        <p>Here is what some of them mean on this server:</p>

        <ul className={styles.clarifications}>
          <li>
            <b>Names.</b> Obscene, offensive or impersonating usernames are
            treated as rule 1 and will be removed, whatever the account has
            done otherwise.
          </li>
          <li>
            <b>One account at a time.</b> You may have as many accounts as you
            like, but only one may be logged in at any moment. Your accounts may
            not interact: no trading between them, no dropping items for
            another one to pick up, no using one to help another in any way.
          </li>
          <li>
            <b>No real-world trading.</b> Nothing in this game may be exchanged
            for real money or for anything outside it — not gold, not items, not
            accounts. There is nothing to buy here and nothing here is worth
            real money.
          </li>
          <li>
            <b>No bots or macros.</b> No third-party program may play for you or
            give you an advantage, and you may not defeat the AFK timer. Mouse
            Keys and similar operating-system accessibility features are allowed
            as accessibility features and for nothing else.
          </li>
          <li>
            <b>No account sharing.</b> One person per account. Do not lend,
            borrow, sell, buy or hand over an account, and never tell anyone
            your password — no member of staff will ever ask for it.
          </li>
          <li>
            <b>No player-run gambling.</b> Hosting a lottery, flower game, dice
            game or any other staking game is not allowed. Staking in the duel
            arena is fine, as long as you are one of the two people duelling.
          </li>
          <li>
            <b>Third-party clients.</b> A client that only changes what you see
            is your business. One that plays for you, automates anything, or
            reveals what the 2004 client could not see is a rule 7 break.
          </li>
        </ul>

        <p>
          All of these are very serious and breaking any of them may result in a
          permanent ban.
        </p>

        <p>
          {SITE_NAME} is a passion project running on volunteer time. Please do
          not test our patience!
        </p>

        <p>
          If you are unsure about a rule, use the{" "}
          <a href="/messages" className={frame.link}>
            message centre
          </a>{" "}
          to ask for clarification.
        </p>

        <p>
          <i>This page was last updated on {RULES_UPDATED}.</i>
        </p>
      </Panel>
    </Frame>
  );
}
