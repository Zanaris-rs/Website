/**
 * The outfit editor's status line (`components/outfits/OutfitEditor.tsx`):
 * one sentence, in a box of fixed height. Browser-safe.
 *
 * A request's answer (`done`: "Saved.", "Deleted.") is about the outfit as it
 * was sent. Editing goes on while a request is out, so by the time the
 * answer comes the draft may have moved on: then the line says so, rather
 * than "Saved." over changes that are not.
 */

export type EditorStatus = {
  text: string;
  /** A request's answer about what was sent, rather than a message about the draft itself. */
  done: boolean;
};

export function editorStatusText({
  checkError,
  status,
  dirty,
}: {
  /** What the outfit check refuses, if it does. */
  checkError: string | null;
  status: EditorStatus | null;
  /** The draft differs from what is saved in its slot. */
  dirty: boolean;
}): string {
  if (checkError) return checkError;
  if (status) return status.done && dirty ? `${status.text} You have changed it since.` : status.text;
  return dirty ? "You have unsaved changes." : "";
}
