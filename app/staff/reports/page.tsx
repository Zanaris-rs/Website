import type { Metadata } from "next";
import { redirect } from "next/navigation";

import StaffReports from "@/components/staff/StaffReports";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { requireSession } from "@/lib/account/session-server";
import { formatWhen } from "@/lib/messages/format";
import {
  type ReportRow,
  parseReportRow,
  parseSince,
  staffReportsStatement,
} from "@/lib/staff/queries";
import { loadStaff } from "@/lib/staff/staff-server";
import { query } from "@/lib/db";

export const metadata: Metadata = {
  title: "Reports",
  description: "Report Abuse rows from the Zanaris game worlds.",
};

export const dynamic = "force-dynamic";

/**
 * Report Abuse, newest first.
 *
 * `?since=<ISO date>` narrows the window; absent or unparseable means the
 * function's own default of a week, which the page says out loud so nobody
 * reads an empty list as "no reports ever".
 */
export default async function Reports({
  searchParams,
}: PageProps<"/staff/reports">) {
  const session = await requireSession();
  const staff = await loadStaff(session);

  if (staff.status === "signed_out" || staff.status === "forbidden") {
    redirect("/account/login");
  }

  if (staff.status === "unavailable") {
    return (
      <Frame>
        <TitleBox title="Reports" />
        <Panel>
          <p>The staff inbox is unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  const params = await searchParams;
  const since = parseSince(
    Array.isArray(params.since) ? params.since[0] : params.since,
  );

  let reports: ReportRow[] = [];
  let failed = false;
  try {
    const wanted = staffReportsStatement(staff.profile.username, since);
    const rows = await query<Record<string, unknown>>(
      wanted.text,
      wanted.values,
    );
    reports = rows
      .map(parseReportRow)
      .filter((report): report is ReportRow => report !== null);
  } catch (error) {
    console.error("[staff] reports read failed", error);
    failed = true;
  }

  if (failed) {
    return (
      <Frame>
        <TitleBox title="Reports" />
        <Panel>
          <p>The staff inbox is unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  return (
    <Frame>
      <StaffReports
        reports={reports}
        since={
          since === null
            ? "the last seven days"
            : `everything since ${formatWhen(since.toISOString())}`
        }
      />
    </Frame>
  );
}
