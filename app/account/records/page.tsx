import type { Metadata } from "next";
import { redirect } from "next/navigation";

import RecordsPanel from "@/components/records/RecordsPanel";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { loadAccount } from "@/lib/account/profile-server";
import { requireSession } from "@/lib/account/session-server";
import { query } from "@/lib/db";
import {
  type RecordCurrentRow,
  type RecordHistoryRow,
  type RecordSkillRow,
  parseRecordCurrent,
  parseRecordHistoryRow,
  parseRecordSkillRow,
  recordAttemptSkillsStatement,
  recordCurrentStatement,
  recordHistoryStatement,
} from "@/lib/records/queries";
import { blockedFrom } from "@/lib/records/verdict";

export const metadata: Metadata = {
  title: "Records",
  description: "Start and stop a timed XP record.",
};

export const dynamic = "force-dynamic";

/**
 * `/account/records` — start a record, watch the timer, stop it, and see why
 * it did or did not count.
 *
 * Three reads, one after another on the site's two-connection pool: where the
 * player is and their newest attempt, that attempt's skills if it has
 * finished, and their history.
 */
export default async function AccountRecords() {
  const session = await requireSession();
  const loaded = await loadAccount(session);

  if (loaded.status === "signed_out") redirect("/account/login");
  if (loaded.status === "unavailable") return <Unavailable />;

  const { username } = loaded.profile;

  let current: RecordCurrentRow;
  let skills: RecordSkillRow[] = [];
  let history: RecordHistoryRow[];
  try {
    const now = recordCurrentStatement(username);
    current = parseRecordCurrent(await query<Record<string, unknown>>(now.text, now.values));

    if (current.attempt && current.attempt.state !== "running") {
      const wanted = recordAttemptSkillsStatement(username, current.attempt.id);
      skills = (await query<Record<string, unknown>>(wanted.text, wanted.values)).map(parseRecordSkillRow);
    }

    const list = recordHistoryStatement(username);
    history = (await query<Record<string, unknown>>(list.text, list.values)).map(parseRecordHistoryRow);
  } catch (error) {
    console.error("[records] account read failed", error);
    return <Unavailable />;
  }

  const blocked = blockedFrom(loaded.profile);

  return (
    <Frame>
      <RecordsPanel current={current} skills={skills} history={history} blocked={blocked} />
    </Frame>
  );
}

function Unavailable() {
  return (
    <Frame>
      <TitleBox title="Records" links={[{ href: "/account", text: "Account Centre" }]} />
      <Panel>
        <p>Records are unavailable right now. Try again shortly.</p>
      </Panel>
    </Frame>
  );
}
