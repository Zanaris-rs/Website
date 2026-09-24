import type { Statement } from "@/lib/account/register";

/**
 * The staff side of Adventurer Log reports (migration 13): the list, and the
 * resolution, which re-types the moderator's password like every other
 * staff verb that changes what players see (`lib/staff/actor-server.ts`).
 */

export type StaffAction = "hide" | "disable_css" | "dismiss";
export const STAFF_ACTIONS: readonly StaffAction[] = ["hide", "disable_css", "dismiss"];

export type AdventureReport = {
  id: number;
  targetKind: "update" | "reply" | "log";
  targetId: number;
  logOwner: string | null;
  author: string | null;
  reporter: string;
  reason: string;
  createdAt: string;
  content: string | null;
  css: string | null;
  contentState: "shown" | "hidden" | "deleted" | "css_disabled";
  resolvedAt: string | null;
  resolution: "hidden" | "css_disabled" | "dismissed" | null;
  resolvedBy: string | null;
  note: string | null;
};

function iso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error(`staff_adventure_reports: bad time ${JSON.stringify(value)}`);
  return date.toISOString();
}

function textOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function staffReportsStatement(actor: string, openOnly: boolean): Statement {
  return {
    text: "select * from accounts.staff_adventure_reports($1, $2)",
    values: [actor, openOnly],
  };
}

export function parseStaffReports(rows: readonly unknown[]): AdventureReport[] {
  return rows.map((raw) => {
    const row = raw as Record<string, unknown>;
    const kind = row.target_kind;
    if (kind !== "update" && kind !== "reply" && kind !== "log") {
      throw new Error(`staff_adventure_reports: kind ${JSON.stringify(kind)}`);
    }
    const state = row.content_state;
    if (state !== "shown" && state !== "hidden" && state !== "deleted" && state !== "css_disabled") {
      throw new Error(`staff_adventure_reports: state ${JSON.stringify(state)}`);
    }
    const resolution = row.resolution;
    if (resolution !== null && resolution !== "hidden" && resolution !== "css_disabled" && resolution !== "dismissed") {
      throw new Error(`staff_adventure_reports: resolution ${JSON.stringify(resolution)}`);
    }
    return {
      id: Number(row.id),
      targetKind: kind,
      targetId: Number(row.target_id),
      logOwner: textOrNull(row.log_owner),
      author: textOrNull(row.author),
      reporter: String(row.reporter),
      reason: String(row.reason),
      createdAt: iso(row.created_at)!,
      content: textOrNull(row.content),
      css: textOrNull(row.css),
      contentState: state,
      resolvedAt: iso(row.resolved_at),
      resolution,
      resolvedBy: textOrNull(row.resolved_by),
      note: textOrNull(row.note),
    };
  });
}

export function staffResolveStatement(
  actor: string,
  candidateHash: string,
  id: number,
  action: StaffAction,
  note: string,
): Statement {
  return {
    text: "select accounts.staff_adventure_resolve($1, $2, $3, $4, $5) as result",
    values: [actor, candidateHash, id, action, note],
  };
}

export const RESOLVE_RESULTS = ["ok", "forbidden", "bad_credentials", "rate_limited", "not_found", "invalid"] as const;
export type ResolveResult = (typeof RESOLVE_RESULTS)[number];

export function parseResolve(raw: unknown): ResolveResult {
  if (typeof raw === "string" && (RESOLVE_RESULTS as readonly string[]).includes(raw)) {
    return raw as ResolveResult;
  }
  throw new Error(`staff_adventure_resolve returned ${JSON.stringify(raw)}`);
}

export const RESOLVE_STATUS: Record<ResolveResult, number> = {
  ok: 200,
  forbidden: 403,
  bad_credentials: 403,
  rate_limited: 429,
  not_found: 404,
  invalid: 400,
};
