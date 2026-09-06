import account from "@/components/account/Account.module.css";
import messages from "@/components/messages/Messages.module.css";
import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { toDisplayName } from "@/lib/base37";
import { formatWhen } from "@/lib/messages/format";
import type { InputStream } from "@/lib/staff/macro/decode";
import type { Metrics } from "@/lib/staff/macro/metrics";
import type { Adjudication, Family, Level } from "@/lib/staff/macro/verdict";
import {
  chatKindLabel,
  coordLabel,
  punishmentUntilLabel,
  reportReasonLabel,
  reporterLabel,
  resolutionLabel,
  wealthEventLabel,
  worldLabel,
} from "@/lib/staff/format";
import {
  chatTotal,
  type ChatRow,
  type InputChunkRow,
  type ReportDetail,
  type WealthRow,
} from "@/lib/staff/queries";

import InputTimeline from "./InputTimeline";
import StaffLiftForm from "./StaffLiftForm";
import StaffResolveForm from "./StaffResolveForm";
import styles from "./Staff.module.css";

/**
 * One report, with everything the world kept about it.
 *
 * The order is the order a moderator reads in: who reported whom and for
 * what, then what evidence exists at all, then the verdict, then the numbers
 * behind the verdict, then the player's own words and their trades, and only
 * then the two forms that do something irreversible.
 *
 * The verdict line is a **family verdict** and never a count of signals. "17
 * of 24" reads as a score and is not one: half those signals are different
 * ways of noticing the same fixed click interval, and a moderator who trusts
 * a fraction will ban somebody for clicking a bank booth in a rhythm. The
 * families, and the false positive printed against every single row of the
 * table, are what make the number honest.
 */

const LEVEL_LABELS: Record<Level, string> = {
  "bot-like": "Bot-like",
  suspicious: "Suspicious",
  "human-like": "Human-like",
  insufficient: "Not enough data",
};

const LEVEL_CLASS: Record<Level, string> = {
  "bot-like": styles.botLike,
  suspicious: styles.suspicious,
  "human-like": styles.humanLike,
  insufficient: styles.insufficient,
};

const VERDICT_CLASS: Record<string, string> = {
  macro: styles.botLike,
  review: styles.suspicious,
  human: styles.humanLike,
  insufficient: styles.insufficient,
};

function millis(iso: string | null): number | null {
  if (iso === null) return null;
  const at = new Date(iso).getTime();
  return Number.isNaN(at) ? null : at;
}

/** "1 line", "2 lines" — a page that says "1 lines" reads as a machine wrote it. */
function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Why a family was left out, in that family's own words.
 *
 * There is more than one way to be withheld and they are not the same
 * sentence: the cursor signals are excluded because the samples behind them
 * were never taken, and the focus signal because the records that carry it may
 * have been thrown away. Printing the spatial reason against the focus row —
 * or, worse, printing `null` — would tell a moderator something untrue about
 * evidence they are about to act on.
 */
function withheldLine(adjudication: Adjudication, family: Family): string {
  if (family === "spatial" && adjudication.spatialWithheld !== null) {
    return `not judged — ${adjudication.spatialWithheld} (a signal from samples nobody took is not evidence)`;
  }
  if (family === "focus" && adjudication.focusWithheld !== null) {
    return `not judged — ${adjudication.focusWithheld} took records out of this capture, and focus is a state carried between records`;
  }
  return "not judged — this capture cannot answer for it";
}

/** "1 hour 5 minutes", for a window nobody wants to subtract by hand. */
function duration(ms: number | null): string {
  if (ms === null || ms <= 0) return "—";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return `${Math.round(ms / 1000)} seconds`;
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export default function StaffReportDetail({
  report,
  input,
  chat,
  wealth,
  stream,
  metrics,
  adjudication,
  evidenceFailed,
}: {
  report: ReportDetail;
  input: readonly InputChunkRow[];
  chat: readonly ChatRow[];
  wealth: readonly WealthRow[];
  stream: InputStream;
  metrics: Metrics;
  adjudication: Adjudication;
  evidenceFailed: boolean;
}) {
  const reportedAt = millis(report.reportedAt);
  const banned = report.offenderBannedUntil !== null;
  const muted = report.offenderMutedUntil !== null;

  const standing: string[] = [];
  if (banned) {
    standing.push(`Banned, ${punishmentUntilLabel(report.offenderBannedUntil)}`);
  }
  if (muted) {
    standing.push(`Muted, ${punishmentUntilLabel(report.offenderMutedUntil)}`);
  }

  // `staff_report_input` is capped at 200 rows and the report row counts what
  // the database holds, so a very long live tail arrives short. Everything
  // below — the verdict included — is computed from what came back, and a
  // partial capture must never be presented as the whole of it.
  const partial = input.length < report.inputChunks;
  // `staff_report_chat` is capped at 2000 rows and returns the count it found
  // before the cap on every row, for the same reason: a talkative offender in
  // a long window arrives short, and the transcript below must not read as the
  // whole of what was said.
  const lines = chatTotal(chat);
  const chatPartial = chat.length < lines;
  const chunks = partial
    ? `${input.length} of ${plural(report.inputChunks, "chunk")}`
    : plural(input.length, "chunk");
  const where = `${stream.ringChunks} from the ring, ${stream.liveChunks} live${partial ? ", the rest not loaded" : ""}`;

  return (
    <>
      <TitleBox
        title="Report"
        links={[
          { href: "/staff/reports", text: "All reports" },
          { href: "/staff/wealth", text: "Wealth search" },
        ]}
      />

      <Panel align="left">
        <div className={account.heading}>
          <b>
            {toDisplayName(report.offender)} —{" "}
            {reportReasonLabel(report.reason)}
          </b>
        </div>

        <table className={`${messages.table} ${styles.tight}`}>
          <tbody>
            <tr>
              <th>Reported</th>
              <td>
                {formatWhen(report.reportedAt)} on {worldLabel(report.world)}
              </td>
            </tr>
            <tr>
              <th>By</th>
              <td className={styles.name}>
                {report.reporter === ""
                  ? reporterLabel(report.reporter)
                  : toDisplayName(report.reporter)}
                , standing at {coordLabel(report.coord)}
              </td>
            </tr>
            <tr>
              <th>Offender</th>
              <td className={styles.name}>
                {report.offenderRegistered ? (
                  <a
                    className={frame.link}
                    href={`/hiscores/player/${encodeURIComponent(report.offender)}`}
                  >
                    {toDisplayName(report.offender)}
                  </a>
                ) : (
                  <>
                    {toDisplayName(report.offender)} (no account with that name)
                  </>
                )}
                {report.offenderWorld === null
                  ? null
                  : ` — on ${worldLabel(report.offenderWorld)}`}
              </td>
            </tr>
            <tr>
              <th>Standing</th>
              <td>
                {/* Both, when both are in force. A ban and a mute are separate
                    columns on the account and a player can be under either or
                    both; showing only the ban hid the mute from the moderator
                    deciding what to do next, and the lift form below offers
                    one for each. */}
                {standing.length === 0 ? "No ban or mute" : standing.join(" · ")}
                {report.offenderLogins24h === null
                  ? null
                  : ` · ${report.offenderLogins24h} logins in 24 hours`}
              </td>
            </tr>
            <tr>
              <th>Address</th>
              <td>
                {report.sameIpAsReporter === null
                  ? "No login to compare — this says nothing either way."
                  : report.sameIpAsReporter
                    ? "The reporter and the offender logged in from the same address."
                    : "The reporter and the offender logged in from different addresses."}
              </td>
            </tr>
            <tr>
              <th>Resolution</th>
              <td>
                {resolutionLabel(report.resolution)}
                {report.resolvedAt === null
                  ? null
                  : ` — ${formatWhen(report.resolvedAt)}${report.resolvedBy === "" ? "" : ` by ${toDisplayName(report.resolvedBy)}`}`}
                {report.staffNote === "" ? null : (
                  <>
                    <br />
                    {report.staffNote}
                  </>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        <p className={account.note}>
          A report carries no text: the 2004 client sends an offender and a rule
          number. Everything below was collected by the world around the moment
          it was sent.
        </p>
      </Panel>

      <Panel align="left">
        <div className={account.heading}>
          <b>Evidence</b>
        </div>

        {evidenceFailed ? (
          <p className={account.error}>
            One of the evidence reads failed. What is shown below may be
            incomplete — reload before deciding anything.
          </p>
        ) : null}

        <table className={`${messages.table} ${styles.tight}`}>
          <tbody>
            <tr>
              <th>Window</th>
              <td>
                {report.windowFrom === null || report.windowTo === null
                  ? "unknown"
                  : `${formatWhen(report.windowFrom)} to ${formatWhen(report.windowTo)}`}
              </td>
            </tr>
            <tr>
              <th>Input</th>
              <td>
                {input.length === 0
                  ? report.uuid === ""
                    ? "None. This report predates evidence capture."
                    : "None kept. Either the offender was on another world, or the evidence has been deleted."
                  : `${chunks} (${where}), ${plural(metrics.clicks, "click")} and ${plural(metrics.moveSamples, "cursor sample")} over ${duration(metrics.durationMs)}`}
              </td>
            </tr>
            <tr>
              <th>Client</th>
              <td>{stream.clients.length === 0 ? "—" : stream.clients.join(", ")}</td>
            </tr>
            <tr>
              <th>Chat</th>
              <td>
                {chatPartial
                  ? `showing ${chat.length} of ${plural(lines, "line")} kept`
                  : `${plural(chat.length, "line")} kept`}
              </td>
            </tr>
            <tr>
              <th>Wealth</th>
              <td>{plural(wealth.length, "event")} in the window</td>
            </tr>
          </tbody>
        </table>

        {stream.flags.length === 0 ? null : (
          <ul className={styles.flags}>
            {stream.flags.map((flag) => (
              <li key={flag}>{FLAG_TEXT[flag] ?? flag}</li>
            ))}
          </ul>
        )}
      </Panel>

      {input.length === 0 ? null : (
        <>
          <Panel align="left">
            <div className={account.heading}>
              <b>Verdict</b>
            </div>

            {partial ? (
              <p className={account.error}>
                Only {input.length} of the {report.inputChunks} captured chunks
                were loaded. This verdict is about the part that was.
              </p>
            ) : null}

            <p
              className={`${styles.verdict} ${VERDICT_CLASS[adjudication.verdict] ?? ""}`}
            >
              {adjudication.headline}
            </p>
            <p className={account.note}>{adjudication.reason}</p>

            <ul className={styles.flags}>
              {adjudication.families.map((family) => (
                <li key={family.family}>
                  <b>{FAMILY_LABELS[family.family]}</b>:{" "}
                  {family.evaluated
                    ? `${family.botLike} bot-like, ${family.suspicious} suspicious, ${family.measured} measured`
                    : withheldLine(adjudication, family.family)}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel align="left">
            <div className={account.heading}>
              <b>What the mouse did</b>
            </div>
            <InputTimeline stream={stream} reportAt={reportedAt} />
          </Panel>

          <Panel align="left">
            <div className={account.heading}>
              <b>Signals</b>
            </div>

            <div className={messages.scroller}>
              <table className={`${messages.table} ${styles.tight}`}>
                <thead>
                  <tr>
                    <th>Signal</th>
                    <th>Family</th>
                    <th>Value</th>
                    <th>Reads as</th>
                  </tr>
                </thead>
                <tbody>
                  {adjudication.signals.map((signal) => (
                    <tr key={signal.key}>
                      <td>
                        {signal.label}
                        <div className={styles.detail}>{signal.detail}</div>
                        <div className={styles.detail}>
                          <i>False positive:</i> {signal.falsePositive}
                        </div>
                      </td>
                      <td className={styles.family}>{FAMILY_LABELS[signal.family]}</td>
                      <td className={styles.name}>{signal.value}</td>
                      <td className={LEVEL_CLASS[signal.level]}>
                        {LEVEL_LABELS[signal.level]}
                        {signal.counted ? "" : " (not counted)"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      <Panel align="left">
        <div className={account.heading}>
          <b>What they said</b>
        </div>

        {chatPartial ? (
          <p className={account.error}>
            Showing the first {chat.length} of {plural(lines, "line")} kept. The
            rest were not loaded — the read stops at 2,000 lines.
          </p>
        ) : null}

        {chat.length === 0 ? (
          <p className={messages.empty}>
            No chat was kept for this report. Public chat lives one hour, so a
            report filed after a quiet window has none.
          </p>
        ) : (
          <div className={messages.scroller}>
            <table className={`${messages.table} ${styles.tight}`}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Kind</th>
                  <th>To</th>
                  <th>Said</th>
                </tr>
              </thead>
              <tbody>
                {chat.map((line, index) => {
                  const at = millis(line.at);
                  const after =
                    reportedAt !== null && at !== null && at >= reportedAt;
                  return (
                    <tr key={`${line.at}-${index}`}>
                      <td className={messages.when}>
                        {formatWhen(line.at)}
                        {after ? " ·" : ""}
                      </td>
                      <td>{chatKindLabel(line.kind)}</td>
                      <td className={styles.name}>
                        {line.toUsername === ""
                          ? ""
                          : toDisplayName(line.toUsername)}
                      </td>
                      <td>{line.message}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className={account.note}>
          The offender&apos;s own words only: their public chat, and the private
          messages they <i>sent</i>. A dot marks a line said after the report.
          Messages other people sent them are not evidence about them and are
          not copied.
        </p>
      </Panel>

      <Panel align="left">
        <div className={account.heading}>
          <b>What changed hands</b>
        </div>

        {wealth.length === 0 ? (
          <p className={messages.empty}>
            No wealth events in the window. These are kept seven days for
            everybody, so an older report has none.
          </p>
        ) : (
          <div className={messages.scroller}>
            <table className={`${messages.table} ${styles.tight}`}>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Event</th>
                  <th>Where</th>
                  <th>Items</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {wealth.map((event, index) => (
                  <tr key={`${event.at}-${index}`}>
                    <td className={messages.when}>{formatWhen(event.at)}</td>
                    <td>{wealthEventLabel(event.eventType)}</td>
                    <td className={styles.name}>{coordLabel(event.coord)}</td>
                    <td className={styles.items}>{event.items}</td>
                    <td className={styles.name}>
                      {event.value === null ? "—" : event.value.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className={account.note}>
          Wealth events are staff-only and never public. They are the engine&apos;s
          own item lists, passed through as they were recorded.
        </p>
      </Panel>

      <Panel align="left">
        <div className={account.heading}>
          <b>Resolve</b>
        </div>
        <StaffResolveForm reportId={report.id} />
      </Panel>

      {banned && report.banPunishmentId !== null ? (
        <Panel align="left">
          <div className={account.heading}>
            <b>Lift the ban</b>
          </div>
          <StaffLiftForm
            punishmentId={report.banPunishmentId}
            kind="ban"
            username={toDisplayName(report.offender)}
          />
        </Panel>
      ) : null}

      {muted && report.mutePunishmentId !== null ? (
        <Panel align="left">
          <div className={account.heading}>
            <b>Lift the mute</b>
          </div>
          <StaffLiftForm
            punishmentId={report.mutePunishmentId}
            kind="mute"
            username={toDisplayName(report.offender)}
          />
        </Panel>
      ) : null}

      {(banned && report.banPunishmentId === null) ||
      (muted && report.mutePunishmentId === null) ? (
        <Panel align="left">
          <p className={account.note}>
            This account is under a punishment with no row in the public record
            — one issued before the record existed. It can only be lifted in
            the database, and <code>punishment.lifted_at</code> must be set by
            hand when it is.
          </p>
        </Panel>
      ) : null}
    </>
  );
}

const FAMILY_LABELS: Record<string, string> = {
  timing: "Timing",
  spatial: "Cursor",
  focus: "Focus",
};

/** What each decoder flag means to somebody reading the page. */
const FLAG_TEXT: Record<string, string> = {
  "unknown-cursor":
    "Part of the capture has no cursor position: it opens with relative moves against a cursor the world never saw an absolute value for.",
  throttled:
    "The client's mouse sampler was running far slower than 50 ms — a background tab. The cursor signals are not judged.",
  "java-client":
    "A Java client, which sends at most one move record per packet. The cursor signals are not judged.",
  flooded:
    "The flood cap tripped: the client sent more than 8 KB of input in 100 ticks and the rest of that window was discarded.",
  "dropped-move":
    "At least one move packet was too long to frame and was dropped. Clicks around it can look like they arrived with no cursor.",
  "ring-wrapped":
    "The ring wrapped: chunks older than this capture were dropped before the report arrived.",
  truncated:
    "A chunk ended in the middle of a record. Everything after that point in it could not be read.",
};
