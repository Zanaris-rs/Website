import { type ClanField, clanFieldOf } from "./client";

/**
 * The pure part of the Clan tab's writes (`components/clans/useClanWrite`):
 * one refusal at a time, shown in the box it came from and marking the
 * field it was about, and whether a press may send at all. Every box reads
 * only its own refusal.
 */

/** A box's last refusal: its sentence, and the field it was about. */
export type WriteStatus<Box extends string> = { box: Box; text: string; field: ClanField | null } | null;

/** A refusal in `box`. `code` is the route's error, when there was a request. */
export function refusal<Box extends string>(
  box: Box,
  text: string,
  code?: string,
): NonNullable<WriteStatus<Box>> {
  return { box, text, field: code === undefined ? null : clanFieldOf(code) };
}

/** The sentence `box`'s status line shows: its own refusal, or nothing. */
export function textIn<Box extends string>(status: WriteStatus<Box>, box: Box): string {
  return status?.box === box ? status.text : "";
}

/** The field of `box` the last refusal marks, if it was that box's. */
export function fieldIn<Box extends string>(status: WriteStatus<Box>, box: Box): ClanField | null {
  return status?.box === box ? status.field : null;
}

/** After an edit in `box`: its refusal and mark are gone; another box's stays. */
export function clearedIn<Box extends string>(status: WriteStatus<Box>, box: Box): WriteStatus<Box> {
  return status?.box === box ? null : status;
}

/**
 * Whether a press sends: never while another write is out (and then no
 * question is asked), and after a "yes" when there is a question.
 */
export function mayStart(busy: boolean, question: string | undefined, ask: (question: string) => boolean): boolean {
  if (busy) return false;
  return question === undefined || ask(question);
}

/** Ids joined for `aria-describedby` (a hint, a status line), or nothing when there are none. */
export function describedBy(...ids: (string | false | null | undefined)[]): string | undefined {
  const joined = ids.filter(Boolean).join(" ");
  return joined === "" ? undefined : joined;
}
