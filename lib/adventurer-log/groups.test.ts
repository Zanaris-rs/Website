import { describe, expect, it } from "vitest";

import { groupLevels, type LevelRun, RUN_GAP_MS } from "./groups";
import type { EntryView } from "./view";

function level(id: number, at: string, text: string): EntryView {
  return { kind: "event", key: `e${id}`, id, at, category: 1, slug: "level", text, icon: null };
}

function milestone(id: number, at: string, text: string): EntryView {
  return { kind: "event", key: `e${id}`, id, at, category: 2, slug: "milestone", text, icon: null };
}

function update(id: number, at: string): EntryView {
  return { kind: "update", key: `u${id}`, id, at, tokens: [], replyCount: 0, replies: [] };
}

function isRun(item: EntryView | LevelRun): item is LevelRun {
  return item.kind === "levels";
}

describe("groupLevels", () => {
  it("merges a run of three level-ups into one row", () => {
    const entries = [
      level(3, "2026-09-25T12:20:00Z", "Levelled up woodcutting from 57 to 58"),
      level(2, "2026-09-25T12:10:00Z", "Levelled up woodcutting from 56 to 57"),
      level(1, "2026-09-25T12:00:00Z", "Levelled up woodcutting from 55 to 56"),
    ];

    const grouped = groupLevels(entries);

    expect(grouped).toHaveLength(1);
    const run = grouped[0];
    if (!isRun(run)) throw new Error("expected a level run");
    expect(run.kind).toBe("levels");
    expect(run.key).toBe("g3");
    expect(run.at).toBe("2026-09-25T12:20:00Z");
    expect(run.gained).toBe(3);
    expect(run.events).toEqual([entries[0], entries[1], entries[2]]);
    expect(run.skills).toEqual([{ stat: 8, name: "Woodcutting", from: 55, to: 58 }]);
  });

  it("splits a run when a gap between neighbours is over an hour", () => {
    const entries = [
      level(3, "2026-09-25T12:20:00Z", "Levelled up woodcutting from 57 to 58"),
      level(2, "2026-09-25T12:10:00Z", "Levelled up woodcutting from 56 to 57"),
      // 70 minutes before id 2: over RUN_GAP_MS, so it cannot join the run above.
      level(1, "2026-09-25T11:00:00Z", "Levelled up woodcutting from 55 to 56"),
    ];

    const grouped = groupLevels(entries);

    expect(grouped).toHaveLength(2);
    const [run, single] = grouped;
    if (!isRun(run)) throw new Error("expected a level run");
    expect(run.key).toBe("g3");
    expect(run.events).toEqual([entries[0], entries[1]]);
    expect(single).toBe(entries[2]);
  });

  it("merges a run exactly RUN_GAP_MS apart, at the boundary", () => {
    const newer = "2026-09-25T13:00:00Z";
    const older = new Date(new Date(newer).getTime() - RUN_GAP_MS).toISOString();
    const entries = [
      level(2, newer, "Levelled up woodcutting from 57 to 58"),
      level(1, older, "Levelled up woodcutting from 56 to 57"),
    ];

    const grouped = groupLevels(entries);

    expect(grouped).toHaveLength(1);
    expect(isRun(grouped[0])).toBe(true);
  });

  it("an update between two would-be runs splits them apart", () => {
    const entries = [
      level(4, "2026-09-25T12:30:00Z", "Levelled up woodcutting from 58 to 59"),
      level(3, "2026-09-25T12:20:00Z", "Levelled up woodcutting from 57 to 58"),
      update(9, "2026-09-25T12:10:00Z"),
      level(2, "2026-09-25T12:00:00Z", "Levelled up woodcutting from 56 to 57"),
      level(1, "2026-09-25T11:50:00Z", "Levelled up woodcutting from 55 to 56"),
    ];

    const grouped = groupLevels(entries);

    expect(grouped).toHaveLength(3);
    const [firstRun, mid, secondRun] = grouped;
    if (!isRun(firstRun) || !isRun(secondRun)) throw new Error("expected level runs either side");
    expect(firstRun.events).toEqual([entries[0], entries[1]]);
    expect(mid).toBe(entries[2]);
    expect(secondRun.events).toEqual([entries[3], entries[4]]);
  });

  it("a total-level milestone splits a run, and is never grouped itself", () => {
    const entries = [
      level(3, "2026-09-25T12:20:00Z", "Levelled up woodcutting from 57 to 58"),
      level(2, "2026-09-25T12:10:00Z", "Levelled up woodcutting from 56 to 57"),
      milestone(9, "2026-09-25T12:00:00Z", "Reached total level 250"),
      level(1, "2026-09-25T11:50:00Z", "Levelled up woodcutting from 55 to 56"),
    ];

    const grouped = groupLevels(entries);

    expect(grouped).toHaveLength(3);
    const [run, mile, single] = grouped;
    if (!isRun(run)) throw new Error("expected a level run");
    expect(run.events).toEqual([entries[0], entries[1]]);
    expect(mile).toBe(entries[2]);
    expect(single).toBe(entries[3]);
  });

  it("a single level-up stays an ordinary EntryView", () => {
    const entries = [level(1, "2026-09-25T12:00:00Z", "Levelled up woodcutting from 55 to 56")];

    const grouped = groupLevels(entries);

    expect(grouped).toEqual(entries);
    expect(grouped[0]).toBe(entries[0]);
  });

  it("unparseable level text never merges, even next to another one", () => {
    const entries: EntryView[] = [
      { kind: "event", key: "e2", id: 2, at: "2026-09-25T12:10:00Z", category: 1, slug: "level", text: "Reached 99 Woodcutting!", icon: null },
      level(1, "2026-09-25T12:00:00Z", "Levelled up woodcutting from 55 to 56"),
    ];

    const grouped = groupLevels(entries);

    expect(grouped).toEqual(entries);
    expect(grouped[0]).toBe(entries[0]);
    expect(grouped[1]).toBe(entries[1]);
  });

  it("orders multi-skill runs by levels gained, then by name", () => {
    const entries = [
      level(7, "2026-09-25T12:00:00Z", "Levelled up firemaking from 31 to 32"),
      level(6, "2026-09-25T11:50:00Z", "Levelled up firemaking from 30 to 31"),
      level(5, "2026-09-25T11:40:00Z", "Levelled up woodcutting from 57 to 58"),
      level(4, "2026-09-25T11:30:00Z", "Levelled up woodcutting from 56 to 57"),
      level(3, "2026-09-25T11:20:00Z", "Levelled up woodcutting from 55 to 56"),
      level(2, "2026-09-25T11:10:00Z", "Levelled up woodcutting from 54 to 55"),
      level(1, "2026-09-25T11:00:00Z", "Levelled up woodcutting from 53 to 54"),
    ];

    const grouped = groupLevels(entries);

    expect(grouped).toHaveLength(1);
    const run = grouped[0];
    if (!isRun(run)) throw new Error("expected a level run");
    expect(run.gained).toBe(7);
    expect(run.skills).toEqual([
      { stat: 8, name: "Woodcutting", from: 53, to: 58 },
      { stat: 11, name: "Firemaking", from: 30, to: 32 },
    ]);
  });

  it("breaks a tie in levels gained by skill name", () => {
    const entries = [
      level(2, "2026-09-25T12:10:00Z", "Levelled up woodcutting from 56 to 57"),
      level(1, "2026-09-25T12:00:00Z", "Levelled up firemaking from 30 to 31"),
    ];

    const grouped = groupLevels(entries);

    const run = grouped[0];
    if (!isRun(run)) throw new Error("expected a level run");
    expect(run.skills.map((skill) => skill.name)).toEqual(["Firemaking", "Woodcutting"]);
  });

  it("keeps the run's key stable when older pages extend the list", () => {
    const base = [
      level(3, "2026-09-25T12:20:00Z", "Levelled up woodcutting from 57 to 58"),
      level(2, "2026-09-25T12:10:00Z", "Levelled up woodcutting from 56 to 57"),
      level(1, "2026-09-25T12:00:00Z", "Levelled up woodcutting from 55 to 56"),
    ];
    const first = groupLevels(base);

    const extended = [
      ...base,
      update(9, "2026-09-25T09:00:00Z"),
      level(5, "2026-09-25T08:10:00Z", "Levelled up cooking from 40 to 41"),
      level(4, "2026-09-25T08:00:00Z", "Levelled up cooking from 39 to 40"),
    ];
    const second = groupLevels(extended);

    expect(isRun(first[0]) && isRun(second[0])).toBe(true);
    if (!isRun(first[0]) || !isRun(second[0])) return;
    expect(second[0].key).toBe(first[0].key);
    expect(second).toHaveLength(3);
  });
});
