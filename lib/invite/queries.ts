import type { Statement } from "@/lib/account/register";

import { INVITE_CODE_PATTERN } from "./code";
import type { DeadInvite, InviteState } from "./format";

/**
 * Every call into migration 6's invite functions, and the parsing of what they
 * answer. The same discipline as `lib/staff/queries.ts`: statements are
 * `{ text, values }` with nothing interpolated, and a result string nobody
 * documented throws instead of being guessed at.
 *
 * The `website` role can execute these and nothing else on the invite tables;
 * the rules - who may mint, the caps, what makes a link dead - live in SQL.
 */

function asIso(value: unknown): string | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === "string" && value !== "") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

function asRecord(row: unknown): Record<string, unknown> | null {
  return typeof row === "object" && row !== null
    ? (row as Record<string, unknown>)
    : null;
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isName(value: unknown): value is string {
  return typeof value === "string" && value !== "";
}

function oneOf<T extends string>(
  allowed: readonly T[],
  raw: unknown,
  where: string,
): T {
  if (typeof raw === "string" && (allowed as readonly string[]).includes(raw)) {
    return raw as T;
  }
  throw new Error(`${where} returned ${JSON.stringify(raw)}`);
}

// --- the door ---------------------------------------------------------------

export type PreviewResult = "ok" | Exclude<DeadInvite, "unavailable">;

const PREVIEW_RESULTS: readonly PreviewResult[] = [
  "ok",
  "not_found",
  "claimed",
  "revoked",
  "expired",
  "rate_limited",
];

export type InvitePreview = {
  readonly result: PreviewResult;
  /** The maker's stored username, for a live link only. */
  readonly inviter: string | null;
};

export function invitePreviewStatement(code: string, ip: string): Statement {
  return {
    text: "select * from accounts.invite_preview($1, $2)",
    values: [code, ip],
  };
}

export function parseInvitePreview(row: unknown): InvitePreview {
  const record = asRecord(row);
  const result = oneOf(PREVIEW_RESULTS, record?.result, "accounts.invite_preview");
  if (result !== "ok") return { result, inviter: null };
  if (!isName(record?.inviter)) {
    throw new Error("accounts.invite_preview returned ok without an inviter");
  }
  return { result, inviter: record.inviter };
}

// --- a player's own links ---------------------------------------------------

export type CreateResult = "ok" | "invalid" | "disabled" | "too_many" | "retry";

const CREATE_RESULTS: readonly CreateResult[] = [
  "ok",
  "invalid",
  "disabled",
  "too_many",
  "retry",
];

export type InviteCreated = {
  readonly result: CreateResult;
  readonly code: string | null;
  readonly expiresAt: string | null;
};

export function inviteCreateStatement(username: string, code: string): Statement {
  return {
    text: "select * from accounts.invite_create($1, $2)",
    values: [username, code],
  };
}

export function parseInviteCreated(row: unknown): InviteCreated {
  const record = asRecord(row);
  const result = oneOf(CREATE_RESULTS, record?.result, "accounts.invite_create");
  if (result !== "ok") return { result, code: null, expiresAt: null };

  const code = record?.code;
  const expiresAt = asIso(record?.expires_at);
  if (typeof code !== "string" || !INVITE_CODE_PATTERN.test(code) || !expiresAt) {
    throw new Error("accounts.invite_create returned ok without a code");
  }
  return { result, code, expiresAt };
}

export type RevokeResult = "ok" | "not_found" | "already_claimed";

export function inviteRevokeStatement(username: string, code: string): Statement {
  return {
    text: "select accounts.invite_revoke($1, $2) as result",
    values: [username, code],
  };
}

export function parseInviteRevokeResult(raw: unknown): RevokeResult {
  return oneOf(
    ["ok", "not_found", "already_claimed"] as const,
    raw,
    "accounts.invite_revoke",
  );
}

export type InviteRow = {
  readonly code: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly state: InviteState;
  readonly claimedBy: string | null;
  readonly claimedAt: string | null;
};

const STATES: readonly InviteState[] = ["live", "claimed", "revoked", "expired"];

export function invitesStatement(username: string): Statement {
  return { text: "select * from accounts.invites($1)", values: [username] };
}

export function parseInviteRow(row: unknown): InviteRow | null {
  const record = asRecord(row);
  if (!record) return null;

  const { code, state } = record;
  const createdAt = asIso(record.created_at);
  const expiresAt = asIso(record.expires_at);
  if (
    typeof code !== "string" ||
    !INVITE_CODE_PATTERN.test(code) ||
    typeof state !== "string" ||
    !(STATES as readonly string[]).includes(state) ||
    !createdAt ||
    !expiresAt
  ) {
    return null;
  }

  return {
    code,
    createdAt,
    expiresAt,
    state: state as InviteState,
    claimedBy: isName(record.claimed_by) ? record.claimed_by : null,
    claimedAt: asIso(record.claimed_at),
  };
}

export type Citizen = {
  readonly citizenNumber: number;
  readonly invitesEnabled: boolean;
  /** Private: shown to this account and to staff, nowhere else. */
  readonly invitedBy: string | null;
};

export function citizenStatement(username: string): Statement {
  return { text: "select * from accounts.citizen($1)", values: [username] };
}

/** Anything unexpected is "no row" - and so never reads as "may invite". */
export function parseCitizen(row: unknown): Citizen | null {
  const record = asRecord(row);
  if (!record) return null;
  if (!isCount(record.citizen_number) || typeof record.invites_enabled !== "boolean") {
    return null;
  }
  return {
    citizenNumber: record.citizen_number,
    invitesEnabled: record.invites_enabled,
    invitedBy: isName(record.invited_by) ? record.invited_by : null,
  };
}

// --- staff --------------------------------------------------------------------

export type StaffSetInvitesResult =
  | "ok"
  | "forbidden"
  | "bad_credentials"
  | "rate_limited"
  | "not_found"
  | "invalid";

/**
 * The candidate hash is second, as in every other staff verb: it is the
 * compare-and-set against the actor's own password.
 */
export function staffSetInvitesStatement(
  actor: string,
  candidateHash: string,
  target: string,
  enabled: boolean,
): Statement {
  return {
    text: "select accounts.staff_set_invites($1, $2, $3, $4) as result",
    values: [actor, candidateHash, target, enabled],
  };
}

export function parseStaffSetInvitesResult(raw: unknown): StaffSetInvitesResult {
  return oneOf(
    ["ok", "forbidden", "bad_credentials", "rate_limited", "not_found", "invalid"] as const,
    raw,
    "accounts.staff_set_invites",
  );
}

export type TreeRow = {
  readonly relation: "self" | "invited_by" | "invited";
  readonly username: string;
  readonly citizenNumber: number;
  readonly invitesEnabled: boolean;
  readonly happenedAt: string | null;
  readonly banned: boolean;
};

export function staffInviteTreeStatement(actor: string, username: string): Statement {
  return {
    text: "select * from accounts.staff_invite_tree($1, $2)",
    values: [actor, username],
  };
}

export function parseTreeRow(row: unknown): TreeRow | null {
  const record = asRecord(row);
  if (!record) return null;
  const { relation } = record;
  if (
    (relation !== "self" && relation !== "invited_by" && relation !== "invited") ||
    !isName(record.username) ||
    !isCount(record.citizen_number)
  ) {
    return null;
  }
  return {
    relation,
    username: record.username,
    citizenNumber: record.citizen_number,
    invitesEnabled: record.invites_enabled === true,
    happenedAt: asIso(record.happened_at),
    banned: record.banned === true,
  };
}

/** One account in the whole tree. `invitedBy` is null for a progenitor. */
export type GenealogyRow = {
  readonly username: string;
  readonly citizenNumber: number;
  readonly invitedBy: number | null;
  readonly joinedAt: string | null;
  readonly invitesEnabled: boolean;
  readonly banned: boolean;
};

export function staffInviteGenealogyStatement(actor: string): Statement {
  return {
    text: "select * from accounts.staff_invite_genealogy($1)",
    values: [actor],
  };
}

export function parseGenealogyRow(row: unknown): GenealogyRow | null {
  const record = asRecord(row);
  if (!record || !isName(record.username) || !isCount(record.citizen_number)) {
    return null;
  }
  const invitedBy = record.invited_by;
  if (invitedBy !== null && invitedBy !== undefined && !isCount(invitedBy)) {
    return null;
  }
  return {
    username: record.username,
    citizenNumber: record.citizen_number,
    invitedBy: isCount(invitedBy) ? invitedBy : null,
    joinedAt: asIso(record.joined_at),
    invitesEnabled: record.invites_enabled === true,
    banned: record.banned === true,
  };
}

export type InviterRow = {
  readonly username: string;
  readonly citizenNumber: number;
  readonly liveLinks: number;
  readonly claimedLinks: number;
  readonly banned: boolean;
};

export function staffInvitersStatement(actor: string): Statement {
  return { text: "select * from accounts.staff_inviters($1)", values: [actor] };
}

export function parseInviterRow(row: unknown): InviterRow | null {
  const record = asRecord(row);
  if (!record || !isName(record.username) || !isCount(record.citizen_number)) {
    return null;
  }
  return {
    username: record.username,
    citizenNumber: record.citizen_number,
    liveLinks: isCount(record.live_links) ? record.live_links : 0,
    claimedLinks: isCount(record.claimed_links) ? record.claimed_links : 0,
    banned: record.banned === true,
  };
}

// --- HTTP ---------------------------------------------------------------------

/**
 * One table for every invite route. `disabled` is 403 because the account is
 * signed in and simply may not; `already_claimed` is a conflict with the
 * link's state; the caps are 429.
 */
export const INVITE_STATUS: Record<string, number> = {
  ok: 200,
  invalid: 400,
  disabled: 403,
  forbidden: 403,
  bad_credentials: 403,
  not_found: 404,
  already_claimed: 409,
  too_many: 429,
  rate_limited: 429,
};

export function inviteStatusFor(result: string): number {
  return INVITE_STATUS[result] ?? 500;
}
