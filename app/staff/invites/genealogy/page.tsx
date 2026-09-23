import type { Metadata } from "next";
import { redirect } from "next/navigation";

import StaffGenealogy from "@/components/staff/StaffGenealogy";
import Frame from "@/components/site/Frame";
import Panel from "@/components/site/Panel";
import TitleBox from "@/components/site/TitleBox";
import { requireSession } from "@/lib/account/session-server";
import { query } from "@/lib/db";
import { type GenealogyNode, buildGenealogy } from "@/lib/invite/genealogy";
import {
  type GenealogyRow,
  parseGenealogyRow,
  staffInviteGenealogyStatement,
} from "@/lib/invite/queries";
import { loadStaff } from "@/lib/staff/staff-server";

export const metadata: Metadata = {
  title: "Genealogy",
  description: "Who invited whom, from the first citizens down, for Zanaris staff.",
};

export const dynamic = "force-dynamic";

/**
 * `/staff/invites/genealogy`: the whole invite tree. Staff-only because who
 * invited whom is private to the two players and staff (migration 6); the SQL
 * answers nobody else either.
 */
export default async function StaffGenealogyPage() {
  const session = await requireSession();
  const staff = await loadStaff(session);

  if (staff.status === "signed_out" || staff.status === "forbidden") {
    redirect("/account/login");
  }

  if (staff.status === "unavailable") {
    return (
      <Frame>
        <TitleBox title="Genealogy" />
        <Panel>
          <p>The staff tools are unavailable right now. Try again shortly.</p>
        </Panel>
      </Frame>
    );
  }

  let rows: GenealogyRow[] = [];
  let tree: GenealogyNode[] = [];
  let error: string | null = null;

  try {
    const wanted = staffInviteGenealogyStatement(staff.profile.username);
    const raw = await query<Record<string, unknown>>(wanted.text, wanted.values);
    rows = raw.map(parseGenealogyRow).filter((row): row is GenealogyRow => row !== null);
    tree = buildGenealogy(rows);
  } catch (readError) {
    console.error("[staff] genealogy read failed", readError);
    error = "The invite records are unavailable right now. Try again shortly.";
  }

  return (
    <Frame>
      <StaffGenealogy tree={tree} accounts={rows.length} error={error} />
    </Frame>
  );
}
