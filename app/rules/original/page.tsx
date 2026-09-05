import type { Metadata } from "next";

import RuleCard from "@/components/rules/RuleCard";
import styles from "@/components/rules/Rules.module.css";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { ORIGINAL_RULES } from "@/lib/rules/original";

export const metadata: Metadata = {
  title: "Rules of conduct",
  description: "The twelve original rules of conduct, as they were in 2004.",
};

/** The 2004 rules page, card for card. `/rules` is what they mean here. */
export default function OriginalRules() {
  return (
    <Frame>
      <TitleBox
        title="Rules of conduct"
        links={[{ href: "/rules", text: "Zanaris rules" }]}
      />

      <Panel>
        <div className={styles.intro}>
          To keep the game enjoyable for everyone there are <b>twelve</b> rules
          you must observe.
          <br />
          We won&apos;t tolerate disruptive players, and if you break our rules
          you will be <b>banned</b>.
        </div>
      </Panel>

      <div className={styles.grid}>
        {ORIGINAL_RULES.map((rule) => (
          <RuleCard key={rule.n} rule={rule} />
        ))}
      </div>
    </Frame>
  );
}
