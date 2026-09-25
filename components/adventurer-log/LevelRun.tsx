"use client";

import { useState } from "react";

import SkillIcon from "@/components/game/SkillIcon";
import { formatWhen } from "@/lib/adventurer-log/format";
import type { LevelRun as LevelRunItem } from "@/lib/adventurer-log/groups";
import { runGz } from "@/lib/adventurer-log/gz";
import type { Look } from "@/lib/chathead/look";

import Entry from "./Entry";
import Gz from "./Gz";

/**
 * One row for a run of level-ups `groupLevels` merged (`lib/adventurer-log/
 * groups.ts`): "Gained 7 levels" with a skill-by-skill breakdown, and
 * "Show each" to expand back into the ordinary `Entry` rows it was built
 * from. The icon is the skill with the most levels - `run.skills` is already
 * sorted that way.
 *
 * The run has one gz, everyone's who gave any level in it (`runGz`): giving
 * one puts it on the newest level, and taking it back takes it from every
 * level (`onGz`, which the timeline passes only to a reader who may give).
 * The levels "Show each" draws have none of their own.
 */
export default function LevelRun({
  run,
  ownerName,
  ownerLook,
  looks,
  onGz,
}: {
  run: LevelRunItem;
  ownerName: string;
  ownerLook: Look | null;
  looks: Readonly<Record<string, Look>>;
  onGz?: () => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const top = run.skills[0];

  return (
    <li className="al-event al-event--level al-levels">
      <span className="al-event-icon" aria-hidden>
        {top ? <SkillIcon stat={top.stat} size={25} /> : null}
      </span>
      {/*
       * The same three direct children as an ordinary event row (icon, text,
       * time), so `.al-event`'s three-column grid lays this out the same way
       * an owner's CSS expects: everything but the icon and the time lives in
       * this one text-column wrapper.
       */}
      <div className="al-event-text al-levels-body">
        <span className="al-levels-summary">Gained {run.gained} levels</span>
        <Gz gz={runGz(run.events)} onToggle={onGz} />
        <ul className="al-levels-skills">
          {run.skills.map((skill) => (
            <li className="al-levels-skill" key={skill.stat}>
              {skill.name} {skill.from} → {skill.to}
            </li>
          ))}
        </ul>
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
      </div>
      <time className="al-time" dateTime={run.at}>
        {formatWhen(run.at)}
      </time>
    </li>
  );
}
