"use client";

import { type ReactNode, useId, useState } from "react";

import { send } from "@/lib/adventurer-log/client";
import { type ClanAction, type ClanField, clanMessages } from "@/lib/clans/client";
import { clearedIn, fieldIn, mayStart, refusal, textIn, type WriteStatus } from "@/lib/clans/write-status";

import styles from "./Clans.module.css";

export type WriteOptions = {
  method?: "POST" | "DELETE";
  /** Asked first; a "no" sends nothing. */
  confirm?: string;
};

export type ClanWrite<Box extends string> = {
  /** A write is out: controls are `aria-disabled`, and `act` does nothing. */
  busy: boolean;
  /** One write from `box`. A success reads the page again; a refusal stays in `box`. */
  act(box: Box, action: ClanAction, url: string, body: unknown, options?: WriteOptions): Promise<void>;
  /** A refusal made in the browser, before any request. */
  refuse(box: Box, text: string): void;
  /** `box`'s status line: always there, so a refusal is announced when it fills. */
  said(box: Box): ReactNode;
  /** The status line's id, for the `aria-describedby` of the field it marks. */
  statusId(box: Box): string;
  /** The field of `box` the last refusal was about, for its `aria-invalid`. */
  invalidFor(box: Box): ClanField | null;
  /** An edit in `box` clears its refusal and mark, as on the Sheet. */
  clearFor(box: Box): void;
};

/**
 * The Clan tab's writes, for `NoClan` and `InClan`: one at a time (`busy`),
 * each through `send()` with the action's sentences (`clanMessages`), a
 * reload when it succeeds, and a refusal said in the box it came from. The
 * pure part is `lib/clans/write-status.ts`.
 */
export function useClanWrite<Box extends string>(): ClanWrite<Box> {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<WriteStatus<Box>>(null);
  const prefix = useId();
  const statusId = (box: Box) => `${prefix}-${box}-status`;

  async function act(box: Box, action: ClanAction, url: string, body: unknown, options: WriteOptions = {}) {
    if (!mayStart(busy, options.confirm, (question) => window.confirm(question))) return;
    setBusy(true);
    setStatus(null);
    const result = await send(url, body, options.method ?? "POST", clanMessages(action));
    if (result.ok) {
      window.location.reload();
      return;
    }
    setBusy(false);
    setStatus(refusal(box, result.message, result.code));
  }

  return {
    busy,
    act,
    refuse: (box, text) => setStatus(refusal(box, text)),
    said: (box) => (
      <p id={statusId(box)} role="status" className={styles.error}>
        {textIn(status, box)}
      </p>
    ),
    statusId,
    invalidFor: (box) => fieldIn(status, box),
    clearFor: (box) => setStatus((current) => clearedIn(current, box)),
  };
}
