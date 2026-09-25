import { skillByName } from "./skill-name";
import type { EntryView } from "./view";

/**
 * Grouping runs of level-ups into one row for the timeline, at render time
 * over the whole loaded list - so "Older adventures" extends a run rather
 * than starting a new one. A single level-up, and a total-level milestone,
 * are never grouped (the owner's call in the sprint 3 spec).
 *
 * Pure and client-safe: it only needs `EntryView`'s shape (imported as a
 * type, so `view.ts`'s `server-only` import is erased) and the tiny skill
 * name lookup in `./skill-name`, not `body.ts`'s item tables.
 */

export type EventEntry = Extract<EntryView, { kind: "event" }>;

export type LevelRunSkill = { stat: number; name: string; from: number; to: number };

export type LevelRun = {
  kind: "levels";
  key: string;
  at: string;
  events: EventEntry[];
  skills: LevelRunSkill[];
  gained: number;
};

export type TimelineItem = EntryView | LevelRun;

/** Neighbours within an hour of each other can join the same run. */
export const RUN_GAP_MS = 60 * 60 * 1000;

const LEVEL_TEXT = /^Levelled up (\w+) from (\d+) to (\d+)$/;

function isLevelEvent(entry: EntryView): entry is EventEntry {
  return entry.kind === "event" && entry.slug === "level" && LEVEL_TEXT.test(entry.text);
}

function capitalize(name: string): string {
  return name.length === 0 ? name : name[0].toUpperCase() + name.slice(1);
}

function buildRun(events: EventEntry[]): LevelRun {
  const skills = new Map<number, LevelRunSkill>();
  let gained = 0;

  for (const event of events) {
    const match = LEVEL_TEXT.exec(event.text);
    if (!match) continue; // isLevelEvent already checked this; keeps TS happy.
    const [, rawName, rawFrom, rawTo] = match;
    const from = Number(rawFrom);
    const to = Number(rawTo);
    gained += to - from;

    const skill = skillByName(rawName);
    const stat = skill ? skill.id : -1;
    const name = skill ? skill.name : capitalize(rawName);

    const existing = skills.get(stat);
    if (existing) {
      existing.from = Math.min(existing.from, from);
      existing.to = Math.max(existing.to, to);
    } else {
      skills.set(stat, { stat, name, from, to });
    }
  }

  const sortedSkills = [...skills.values()].sort(
    (a, b) => b.to - b.from - (a.to - a.from) || a.name.localeCompare(b.name),
  );

  return {
    kind: "levels",
    key: `g${events[0].id}`,
    at: events[0].at,
    events,
    skills: sortedSkills,
    gained,
  };
}

/**
 * Groups runs of two or more consecutive level-ups (newest first, like
 * `entries` itself) into `LevelRun` rows; everything else - updates, other
 * adventures, milestones, a single level-up, unparseable level text - passes
 * through unchanged.
 */
export function groupLevels(entries: readonly EntryView[], gapMs: number = RUN_GAP_MS): TimelineItem[] {
  const out: TimelineItem[] = [];
  let i = 0;

  while (i < entries.length) {
    const entry = entries[i];
    if (!isLevelEvent(entry)) {
      out.push(entry);
      i++;
      continue;
    }

    let j = i + 1;
    while (
      j < entries.length &&
      isLevelEvent(entries[j]) &&
      Math.abs(new Date(entries[j - 1].at).getTime() - new Date(entries[j].at).getTime()) <= gapMs
    ) {
      j++;
    }

    const run = entries.slice(i, j) as EventEntry[];
    out.push(run.length >= 2 ? buildRun(run) : entry);
    i = j;
  }

  return out;
}
