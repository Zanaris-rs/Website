import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import StaffReportDetail from "@/components/staff/StaffReportDetail";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { requireSession } from "@/lib/account/session-server";
import { parseId } from "@/lib/messages/queries";
import { decodeStream } from "@/lib/staff/macro/decode";
import { measure } from "@/lib/staff/macro/metrics";
import { adjudicate } from "@/lib/staff/macro/verdict";
import { loadReport } from "@/lib/staff/report-server";
import { loadStaff } from "@/lib/staff/staff-server";

export const metadata: Metadata = {
  title: "Report",
  description: "A Report Abuse row and the evidence behind it.",
};

export const dynamic = "force-dynamic";

/**
 * One report, with the input capture decoded and judged.
 *
 * The decoding is done **here, on the server**, on every request. It is a few
 * milliseconds of arithmetic over at most a couple of hundred kilobytes, and
 * doing it here rather than in the browser is what lets the page render as
 * plain HTML and an SVG: a moderator's evidence must not depend on a script
 * having loaded.
 *
 * Nothing on this page writes. The two forms post to their own routes, which
 * re-type a password, so opening a report — including one a moderator opens by
 * guessing an id — changes nothing at all.
 */
export default async function StaffReport({
  params,
}: PageProps<"/staff/reports/[id]">) {
  const session = await requireSession();
  const staff = await loadStaff(session);

  if (staff.status === "signed_out" || staff.status === "forbidden") {
    redirect("/account/login");
  }

  const { id: raw } = await params;
  const id = parseId(raw);
  if (id === null) notFound();

  if (staff.status === "unavailable") return <Unavailable />;

  const loaded = await loadReport(staff.profile.username, id);
  if (loaded.status === "unavailable") return <Unavailable />;
  // `staff_report` answers emptily both for a report that does not exist and
  // for an actor who is not staff. The page cannot tell them apart and must
  // not try: 404 is the right answer to both.
  if (loaded.status === "not_found") notFound();

  const stream = decodeStream(loaded.input);
  const metrics = measure(stream);
  const adjudication = adjudicate(metrics, stream);

  return (
    <Frame>
      <StaffReportDetail
        report={loaded.report}
        input={loaded.input}
        chat={loaded.chat}
        wealth={loaded.wealth}
        stream={stream}
        metrics={metrics}
        adjudication={adjudication}
        evidenceFailed={loaded.evidenceFailed}
      />
    </Frame>
  );
}

function Unavailable() {
  return (
    <Frame>
      <TitleBox title="Report" />
      <Panel>
        <p>The staff tools are unavailable right now. Try again shortly.</p>
      </Panel>
    </Frame>
  );
}
