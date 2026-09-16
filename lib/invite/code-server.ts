import "server-only";

import { randomBytes } from "node:crypto";

import { INVITE_BYTES, encodeInviteCode } from "./code";

/** A fresh code. Only a route handler mints one. */
export function newInviteCode(): string {
  return encodeInviteCode(randomBytes(INVITE_BYTES));
}
