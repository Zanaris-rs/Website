"use client";

import { useState } from "react";

import SkillIcon from "@/components/game/SkillIcon";
import { formatWhen } from "@/lib/adventurer-log/format";
import type { LevelRun as LevelRunItem } from "@/lib/adventurer-log/groups";
import type { Look } from "@/lib/chathead/look";

import Entry from "./Entry";

/**
 * One row for a run of level-ups `groupLevels` merged (`lib/adventurer-log/
 * groups.ts`): "Gained 7 levels" with a skill-by-skill breakdown, and
 * "Show each" to expand back into the ordinary `Entry` rows it was built
 * from. The icon is the skill with the most levels - `run.skills` is already
 * sorted that way.
 */
export default function LevelRun({
  run,
  ownerName,
  ownerLook,
  looks,
}: {
  run: LevelRunItem;
  ownerName: string;
  ownerLook: Look | null;
  looks: Readonly<Record<string, Look>>;
}) {
  const [expanded, setExpanded] = useState(false);
  const top = run.skills[0];

  return (
    <li className="al-event al-event--level al-levels">
      <span className="al-event-icon" aria-hidden>
        {top ? <SkillIcon stat={top.stat} size={25} /> : null}
      </span>
      <span className="al-levels-summary">Gained {run.gained} levels</span>
      <ul className="al-levels-skills">
        {run.skills.map((skill) => (
          <li className="al-levels-skill" key={skill.stat}>
            {skill.name} {skill.from} → {skill.to}
          </li>
        ))}
      </ul>
      <time className="al-time" dateTime={run.at}>
        {formatWhen(run.at)}
      </time>
      <button type="button" className="al-levels-toggle" onClick={() => setExpanded((shown) => !shown)}>
        {expanded ? "Hide" : "Show each"}
      </button>
      {expanded ? (
        <ul className="al-levels-each">
          {run.events.map((event) => (
            <Entry key={event.key} entry={event} ownerName={ownerName} ownerLook={ownerLook} looks={looks} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
