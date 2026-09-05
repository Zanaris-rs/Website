import account from "@/components/account/Account.module.css";
import styles from "@/components/messages/Messages.module.css";
import frame from "@/components/site/Frame.module.css";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { toDisplayName } from "@/lib/base37";
import { formatWhen } from "@/lib/messages/format";
import {
  coordLabel,
  reportReasonLabel,
  reporterLabel,
  resolutionLabel,
  worldLabel,
} from "@/lib/staff/format";
import type { ReportRow } from "@/lib/staff/queries";

import staff from "./Staff.module.css";

/**
 * Report Abuse, as a list.
 *
 * These rows only exist from Part 3 onwards, and that is worth saying on the
 * page: the packet used to be posted to the logger thread, the logger server
 * is disabled on this fleet, and every report was therefore dropped while the
 * player was told it had been received. The login server writes them now and
 * knows both who pressed the button and which world they were on.
 *
 * There is no text with a report — the 2004 packet carries an offender, a rule
 * number and nothing else — so the columns are all there will ever be. The
 * rule number is shown as the rule it names, from the same list `/rules`
 * renders, and the packed coordinate as the place the reporter was standing.
 */
export default function StaffReports({
  reports,
  since,
}: {
  reports: readonly ReportRow[];
  /** The window the list covers, in words. */
  since: string;
}) {
  return (
    <>
      <TitleBox
        title="Reports"
        links={[
          { href: "/staff", text: "Staff inbox" },
          { href: "/staff/notice", text: "Send a notice" },
          { href: "/staff/wealth", text: "Wealth" },
        ]}
      />

      <Panel align="left">
        <div className={account.heading}>
          <b>Report Abuse</b>
        </div>

        <div className={staff.since}>Showing {since}.</div>

        {reports.length === 0 ? (
          <p className={styles.empty}>No reports in this window.</p>
        ) : (
          <div className={styles.scroller}>
          <table className={`${styles.table} ${staff.tight}`}>
            <thead>
              <tr>
                <th>When</th>
                <th>World</th>
                <th>Reporter</th>
                <th>Offender</th>
                <th>Rule</th>
                <th>Where</th>
                <th>Evidence</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td className={styles.when}>
                    <a className={frame.link} href={`/staff/reports/${report.id}`}>
                      {formatWhen(report.reportedAt)}
                    </a>
                  </td>
                  <td>{worldLabel(report.world)}</td>
                  <td className={staff.name}>
                    {report.reporter === ""
                      ? reporterLabel(report.reporter)
                      : toDisplayName(report.reporter)}
                  </td>
                  <td className={staff.name}>
                    <a
                      className={frame.link}
                      href={`/hiscores/player/${encodeURIComponent(report.offender)}`}
                    >
                      {toDisplayName(report.offender)}
                    </a>
                  </td>
                  <td>{reportReasonLabel(report.reason)}</td>
                  <td className={staff.name}>{coordLabel(report.coord)}</td>
                  <td className={report.hasEvidence ? staff.humanLike : ""}>
                    {report.hasEvidence ? "kept" : "none"}
                  </td>
                  <td
                    className={
                      report.resolution === null ? staff.suspicious : ""
                    }
                  >
                    {resolutionLabel(report.resolution)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}

        <p className={account.note}>
          A report carries no text: the 2004 client sends an offender and a rule
          number, and that is all there is. Rows from before the Message Centre
          existed have no reporter and no world, and read as unknown.
        </p>
        <p className={account.note}>
          The date opens the report. <b>Evidence</b> is the input capture and
          the copied chat the world kept for it: macro and bug-abuse reports get
          one, everything else does not, and a report resolved as dismissed has
          had its evidence deleted. Nothing here is kept longer than thirty days.
        </p>
      </Panel>
    </>
  );
}
