import type { Metadata } from "next";
import { redirect } from "next/navigation";

import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import AdventureReports from "@/components/staff/AdventureReports";
import { requireSession } from "@/lib/account/session-server";
import { type AdventureReport, parseStaffReports, staffReportsStatement } from "@/lib/adventurer-log/staff";
import { query } from "@/lib/db";
import { staffLinks } from "@/lib/staff/links";
import { loadStaff } from "@/lib/staff/staff-server";

export const metadata: Metadata = {
  title: "Log reports",
  description: "Reports of Adventurer Log updates, replies and pages.",
};

export const dynamic = "force-dynamic";

/**
 * `/staff/adventure-reports` — what players reported on each other's
 * Adventurer Logs, open ones first. `?all=1` includes resolved ones.
 */
export default async function LogReports({ searchParams }: PageProps<"/staff/adventure-reports">) {
  const session = await requireSession();
  const staff = await loadStaff(session);
  if (staff.status === "signed_out" || staff.status === "forbidden") redirect("/account/login");

  const all = (await searchParams).all === "1";
  let reports: AdventureReport[] | null = null;
  if (staff.status === "ok") {
    try {
      const statement = staffReportsStatement(staff.profile.username, !all);
      reports = parseStaffReports(await query<Record<string, unknown>>(statement.text, statement.values));
    } catch (error) {
      console.error("[staff] adventure reports read failed", error);
    }
  }

  return (
    <Frame>
      <TitleBox title="Log reports" links={staffLinks("/staff/adventure-reports")} />
      <Panel align="left" width="100%">
        {reports === null ? (
          <p>The staff inbox is unavailable right now. Try again shortly.</p>
        ) : (
          <>
            <p>
              {all ? (
                <a href="/staff/adventure-reports">Open reports only</a>
              ) : (
                <a href="/staff/adventure-reports?all=1">Include resolved reports</a>
              )}
            </p>
            <AdventureReports reports={reports} />
          </>
        )}
      </Panel>
    </Frame>
  );
}
