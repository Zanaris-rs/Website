import frame from "@/components/site/Frame.module.css";
import StoneCaption from "@/components/site/StoneCaption";
import Tile from "@/components/site/Tile";
import { ruleImage, type Rule } from "@/lib/rules/original";

import styles from "./Rules.module.css";

/**
 * One of the twelve rule cards: the stone caption and the 100x75 illustration
 * on the left, "Rule N." and the text on the right, in a 240px bordered box.
 */
export default function RuleCard({ rule }: { rule: Rule }) {
  return (
    <div className={styles.card}>
      <div
        className={`${frame.panel} ${styles.cardInner}`}
        style={{ minHeight: rule.height }}
      >
        <div className={styles.cardArt}>
          <StoneCaption variant="grey" width={100} height={40}>
            {rule.caption}
          </StoneCaption>
          <div className={styles.cardImage}>
            <Tile src={ruleImage(rule)} width={100} height={75} />
          </div>
        </div>
        <div className={styles.cardText}>
          <b>Rule {rule.n}.</b>
          <br />
          {rule.text.map((paragraph, index) => (
            <p key={index} className={styles.cardParagraph}>
              {paragraph}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
