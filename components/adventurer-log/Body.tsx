import ItemIcon from "@/components/game/ItemIcon";
import SkillIcon from "@/components/game/SkillIcon";
import type { BodyToken } from "@/lib/adventurer-log/body";

/**
 * A post's text with its game pictures, from the tokens the server cut it
 * into (`lib/adventurer-log/body.ts`). Text is React text - escaped, never
 * markup - and keeps its line breaks through the stylesheet's pre-wrap.
 */
export default function Body({ tokens }: { tokens: readonly BodyToken[] }) {
  return (
    <span className="al-text">
      {tokens.map((token, i) => {
        if (token.t === "text") return <span key={i}>{token.v}</span>;
        if (token.t === "item") {
          return (
            <span key={i} className="al-asset" title={token.name}>
              <ItemIcon id={token.id} size={24} alt={token.name} />
            </span>
          );
        }
        return (
          <span key={i} className="al-asset" title={token.name}>
            <SkillIcon stat={token.stat} size={20} alt={token.name} />
          </span>
        );
      })}
    </span>
  );
}
