import "server-only";

import { isConfigured, query } from "@/lib/db";

import {
  type ChatRow,
  type InputChunkRow,
  type ReportDetail,
  type WealthRow,
  parseChatRow,
  parseInputChunkRow,
  parseReportDetail,
  parseWealthRow,
  staffReportChatStatement,
  staffReportInputStatement,
  staffReportStatement,
  staffReportWealthStatement,
} from "./queries";

/**
 * The four reads behind `/staff/reports/<id>`, and what to do when one of
 * them fails.
 *
 * The report row is the page: without it there is nothing to show and the
 * page is a 404. The three evidence reads are not, and they fail for reasons
 * that are not errors — a report older than thirty days has had its input and
 * chat reaped, a report resolved as `dismissed` had them deleted on purpose,
 * and `session_wealth` keeps seven days for everybody. So an evidence read
 * that throws leaves the rest of the page standing and says what is missing,
 * rather than replacing a moderator's whole view with "unavailable".
 *
 * They run in parallel because they are four independent `SECURITY DEFINER`
 * calls and the pool has two connections: `Promise.all` here is a page that
 * renders in one round trip instead of four.
 */

export type ReportLoad =
  | {
      readonly status: "ok";
      readonly report: ReportDetail;
      readonly input: readonly InputChunkRow[];
      readonly chat: readonly ChatRow[];
      readonly wealth: readonly WealthRow[];
      /** True when an evidence read failed rather than answering emptily. */
      readonly evidenceFailed: boolean;
    }
  /** No such report, or the actor is not staff — the function says the same. */
  | { readonly status: "not_found" }
  | { readonly status: "unavailable" };

async function rows(statement: {
  text: string;
  values: readonly unknown[];
}): Promise<Record<string, unknown>[]> {
  return query<Record<string, unknown>>(statement.text, statement.values);
}

export async function loadReport(
  actor: string,
  id: number,
): Promise<ReportLoad> {
  if (!isConfigured()) return { status: "unavailable" };

  let report: ReportDetail | null;
  try {
    const wanted = staffReportStatement(actor, id);
    report = parseReportDetail((await rows(wanted))[0]);
  } catch (error) {
    console.error("[staff] report read failed", error);
    return { status: "unavailable" };
  }

  if (!report) return { status: "not_found" };

  let evidenceFailed = false;
  const [input, chat, wealth] = await Promise.all([
    rows(staffReportInputStatement(actor, id)).catch((error: unknown) => {
      console.error("[staff] report input read failed", error);
      evidenceFailed = true;
      return [];
    }),
    rows(staffReportChatStatement(actor, id)).catch((error: unknown) => {
      console.error("[staff] report chat read failed", error);
      evidenceFailed = true;
      return [];
    }),
    rows(staffReportWealthStatement(actor, id)).catch((error: unknown) => {
      console.error("[staff] report wealth read failed", error);
      evidenceFailed = true;
      return [];
    }),
  ]);

  return {
    status: "ok",
    report,
    input: input
      .map(parseInputChunkRow)
      .filter((row): row is InputChunkRow => row !== null),
    chat: chat.map(parseChatRow).filter((row): row is ChatRow => row !== null),
    wealth: wealth
      .map(parseWealthRow)
      .filter((row): row is WealthRow => row !== null),
    evidenceFailed,
  };
}
