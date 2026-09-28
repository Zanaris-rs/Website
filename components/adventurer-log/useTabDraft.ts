import { type FormEvent, useState } from "react";

import { useUnsavedGuard } from "@/components/site/useUnsavedGuard";
import {
  type DraftField,
  draftDirty,
  SAVE_MESSAGES,
  saveDraft,
  type SaveStatus,
  saveStatusText,
} from "@/lib/adventurer-log/character-draft";
import { send } from "@/lib/adventurer-log/client";
import type { Check } from "@/lib/adventurer-log/persona-input";

export type TabDraft<T> = {
  draft: T;
  /** Replace the draft (as typing does), clearing the last Save's line and marks. */
  change(next: T): void;
  /** Change one field of the draft. */
  set<K extends keyof T>(key: K, value: T[K]): void;
  /** The draft differs from what was last saved; leaving the page asks first. */
  dirty: boolean;
  /** A Save is on its way: Save is `aria-disabled`, and pressing it does nothing. */
  busy: boolean;
  /** The line beside Save (`saveStatusText`). */
  message: string;
  /** The line is a refusal, shown as one. */
  refused: boolean;
  /** `aria-invalid` for a field the last refusal was about. */
  marked(field: DraftField): true | undefined;
  /** The form's submit: check, post, and take what was saved as the draft. */
  save(event: FormEvent): Promise<void>;
};

/**
 * One Character tab's draft with one Save (Words, Sheet): the draft and what
 * was last saved, the unsaved-changes guard, the fields a refusal marks, and
 * the line beside the Save button. The Save itself is `saveDraft`: checked as
 * the server will, then posted to `url`.
 */
export function useTabDraft<T>(initial: T, url: string, check: (raw: unknown) => Check<T>): TabDraft<T> {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>(null);
  const [invalid, setInvalid] = useState<readonly DraftField[]>([]);
  const [busy, setBusy] = useState(false);

  const dirty = draftDirty(draft, saved);
  useUnsavedGuard(dirty);

  function change(next: T) {
    setDraft(next);
    setStatus(null);
    setInvalid([]);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const sent = draft;
    setBusy(true);
    const outcome = await saveDraft(sent, check, (value) => send(url, value, "POST", SAVE_MESSAGES));
    setBusy(false);
    if (!outcome.ok) {
      setStatus({ kind: "error", message: outcome.message });
      setInvalid(outcome.fields);
      return;
    }
    // What was checked is what the server saved; the draft becomes it
    // unless it has moved on while the Save was out.
    setSaved(outcome.value);
    setDraft((current) => (current === sent ? outcome.value : current));
    setStatus({ kind: "saved" });
  }

  return {
    draft,
    change,
    set: (key, value) => change({ ...draft, [key]: value }),
    dirty,
    busy,
    message: saveStatusText(busy, status, dirty),
    refused: status?.kind === "error",
    marked: (field) => invalid.includes(field) || undefined,
    save,
  };
}
