import account from "@/components/account/Account.module.css";
import SkillIcon from "@/components/game/SkillIcon";
import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { formatWhen } from "@/lib/account/profile";
import { categoryName, OVERALL } from "@/lib/hiscores/categories";
import { BOARD_PATH, type RecordCurrentResponse } from "@/lib/records/api";
import { DEFAULT_DURATION, recordDuration, type RecordDuration } from "@/lib/records/durations";
import { formatElapsed, formatGain } from "@/lib/records/format";
import type { RecordHistoryRow, RecordSkillRow } from "@/lib/records/queries";
import {
  RULE_STEPS,
  RULE_TIMING,
  historyLabel,
  verdictFor,
  type RuleLine,
  type Tone,
} from "@/lib/records/verdict";
import { statOfCategory } from "@/lib/skills/icons";

import RecordLive from "./RecordLive";
import styles from "./Records.module.css";

const TONE_CLASS: Record<Tone, string> = {
  good: frame.green,
  bad: frame.red,
  ours: frame.yellow,
  neutral: frame.white,
};

/**
 * `/account/records`: the rules, Start/Stop and the timer, how the newest
 * attempt finished, and the account's history - rejected and void attempts
 * included, because telling the player why is what they are kept for.
 */
export default function RecordsPanel({
  current,
  skills,
  history,
  blocked,
}: {
  current: RecordCurrentResponse;
  /** The newest attempt's per-skill rows, when it has finished. */
  skills: readonly RecordSkillRow[];
  history: readonly RecordHistoryRow[];
  blocked: "staff" | "banned" | null;
}) {
  const attempt = current.attempt;
  const duration = (attempt && recordDuration(attempt.durationSeconds)) || DEFAULT_DURATION;
  const finished = attempt && attempt.state !== "running" ? attempt : null;

  return (
    <>
      <TitleBox
        title="Records"
        width="min(340px, 100%)"
        links={[
          { href: "/account", text: "Account Centre" },
          { href: BOARD_PATH, text: "Record board" },
        ]}
      />

      <Panel align="left" width="min(560px, 100%)">
        <div className={account.heading}>
          <b>How a {duration.adjective} record works</b>
        </div>
        <ol className={styles.rules}>
          {RULE_STEPS.map((line, index) => (
            <li key={index}>
              <Rule line={line} />
            </li>
          ))}
        </ol>
        <p className={styles.timing}>
          <Rule line={RULE_TIMING} />
        </p>
      </Panel>

      <Panel width="min(560px, 100%)">
        {/* Keyed on the attempt and its state, so a refresh that brings a new
            attempt (or a verdict) remounts it with the server's answer rather
            than keeping a stale one in state. */}
        <RecordLive
          key={attempt ? `${attempt.id}:${attempt.state}` : "none"}
          initial={current}
          blocked={blocked}
        />
      </Panel>

      {finished ? (
        <Panel width="min(560px, 100%)">
          <Verdict attempt={finished} skills={skills} duration={duration} />
        </Panel>
      ) : null}

      <Panel width="min(560px, 100%)">
        <div className={account.heading}>
          <b>Your attempts</b>
        </div>
        {history.length === 0 ? (
          <p className={account.note}>You haven&apos;t started a record yet.</p>
        ) : (
          <div className={account.scroller}>
            <table className={account.logins}>
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Result</th>
                  <th>XP</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td>{formatWhen(row.startedAt)}</td>
                    <td>{historyLabel(row.state, row.reason)}</td>
                    <td>{row.gainedValue === null ? "–" : formatGain(row.gainedValue)}</td>
                    <td>{row.elapsedMs === null ? "–" : formatElapsed(row.elapsedMs)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}

/** A line of the rules, with the button names in bold as they are on the buttons. */
function Rule({ line }: { line: RuleLine }) {
  return line.map((part, index) =>
    typeof part === "string" ? part : <b key={index}>{part.button}</b>,
  );
}

function Verdict({
  attempt,
  skills,
  duration,
}: {
  attempt: NonNullable<RecordCurrentResponse["attempt"]>;
  skills: readonly RecordSkillRow[];
  duration: RecordDuration;
}) {
  if (attempt.state === "running") return null;

  const verdict = verdictFor(
    {
      state: attempt.state,
      reason: attempt.reason,
      elapsedMs: attempt.elapsedMs,
      gainedValue: attempt.gainedValue,
      boardRank: attempt.boardRank,
    },
    duration,
  );

  // The skills that moved, most first. Overall is the footer, not a row.
  const moved = skills
    .filter((row) => row.category !== OVERALL && row.gainedValue !== null && row.gainedValue > 0)
    .sort((a, b) => (b.gainedValue ?? 0) - (a.gainedValue ?? 0));
  const overall = skills.find((row) => row.category === OVERALL);

  return (
    <div className={styles.verdict}>
      <p className={`${styles.verdictTitle} ${TONE_CLASS[verdict.tone]}`}>{verdict.title}</p>
      {verdict.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}

      {moved.length > 0 ? (
        <table className={styles.skills}>
          <tbody>
            {moved.map((row) => (
              <tr key={row.category}>
                <th scope="row" className={styles.skill}>
                  <span className={styles.skillCell}>
                    <SkillIcon stat={statOfCategory(row.category)} size={16} />
                    {categoryName(row.category) ?? `Skill ${row.category}`}
                  </span>
                </th>
                <td className={styles.figure}>{formatGain(row.gainedValue ?? 0)}</td>
              </tr>
            ))}
          </tbody>
          {overall?.gainedValue ? (
            <tfoot>
              <tr>
                <th scope="row" className={styles.skill}>
                  Overall
                </th>
                <td className={styles.figure}>{formatGain(overall.gainedValue)}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      ) : null}
    </div>
  );
}
