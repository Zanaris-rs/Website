import SkillIcon from "@/components/game/SkillIcon";
import { combatRange, overallOf, skillRows, type SkillRow } from "@/lib/adventurer-log/skills";
import type { PlayerSkill } from "@/lib/hiscores/api";
import { OVERALL } from "@/lib/hiscores/categories";
import { formatNumber } from "@/lib/hiscores/format";
import { statOfCategory } from "@/lib/skills/icons";

/**
 * The log's Skills box: every one of the 19 skills, Overall's total level and
 * rank, and the combat level `skills.ts` works out from them.
 *
 * A skill under level 15 has no hiscore row at all (`buildHiscoreRows` on the
 * engine side), so it is drawn greyed - `.al-skill--unranked` - with "under
 * 15" where the xp and rank would be and "<15" for the level; the note under
 * the table only appears when at least one row is like that. Its `al-`
 * classes: `.al-skill-total`, `.al-combat`, `.al-skill` (`.al-skill--<id>`,
 * `.al-skill--unranked`), `.al-skill-xp`, `.al-skill-level` and
 * `.al-skills-note`.
 */
export default function Skills({
  username,
  skills,
}: {
  /** Stored name, for the hiscores links - never the display form. */
  username: string;
  skills: readonly PlayerSkill[];
}) {
  if (skills.length === 0) {
    return (
      <section className="al-stats al-box">
        <h2>Skills</h2>
        <div className="al-box-body">
          <p className="al-empty">Not on the hiscores yet.</p>
        </div>
      </section>
    );
  }

  const rows = skillRows(skills);
  const overall = overallOf(skills);
  const combat = combatRange(skills);
  const anyUnranked = rows.some((row) => row.ranked === null);

  return (
    <section className="al-stats al-box">
      <h2>Skills</h2>
      <div className="al-box-body">
        {overall ? (
          <p className="al-skill-total">
            <a href={hiscoresHref(OVERALL, username)}>
              Total level {overall.level} · {formatNumber(overall.xp)} xp · #{formatNumber(overall.rank)}
            </a>
          </p>
        ) : null}
        <p className="al-combat">
          Combat {combat.min === combat.max ? combat.min : `${combat.min}–${combat.max}`}
        </p>
        <table>
          <tbody>
            {rows.map((row) => (
              <tr key={row.category} className={rowClass(row)}>
                <td>
                  <SkillIcon stat={statOfCategory(row.category)} size={16} />
                </td>
                <td>
                  <a href={hiscoresHref(row.category, username)}>{row.name}</a>
                  <span className="al-skill-xp">
                    {row.ranked ? `${formatNumber(row.ranked.xp)} xp · #${formatNumber(row.ranked.rank)}` : "under 15"}
                  </span>
                </td>
                <td className="al-skill-level">{row.ranked ? row.ranked.level : "<15"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {anyUnranked ? (
          <p className="al-skills-note">
            Skills under level 15 aren&rsquo;t on the hiscores, so they show as under 15.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function rowClass(row: SkillRow): string {
  const classes = ["al-skill", `al-skill--${row.category}`];
  if (!row.ranked) classes.push("al-skill--unranked");
  return classes.join(" ");
}

function hiscoresHref(category: number, username: string): string {
  return `/hiscores?category=${category}&name=${encodeURIComponent(username)}`;
}
