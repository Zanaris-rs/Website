"use client";

import { useRef, useState } from "react";

import ItemIcon from "@/components/game/ItemIcon";
import SkillIcon from "@/components/game/SkillIcon";

type Match =
  | { kind: "item"; code: string; name: string; id: number }
  | { kind: "skill"; code: string; name: string; stat: number };

/**
 * A text box for an update or a reply, with the game's pictures a search
 * away: typing in the picker asks the server for items and skills, and
 * clicking one puts its shortcode where the cursor is. The post itself is
 * plain text; the server turns the codes into pictures. Editing an update
 * starts it from that update's text (`initial`) and adds a Cancel button.
 */
export default function Composer({
  max,
  rows = 3,
  placeholder,
  submitLabel,
  initial = "",
  onSubmit,
  onCancel,
}: {
  max: number;
  rows?: number;
  placeholder: string;
  submitLabel: string;
  /** The text to start from; empty for a new post. */
  initial?: string;
  /** Resolves to an error sentence, or null when it was posted. */
  onSubmit: (text: string) => Promise<string | null>;
  /** Given, there is a Cancel button, and this is what it does. */
  onCancel?: () => void;
}) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const box = useRef<HTMLTextAreaElement>(null);
  const searchSeq = useRef(0);

  async function search(value: string) {
    setQuery(value);
    const seq = ++searchSeq.current;
    if (value.trim().length < 2) {
      setMatches([]);
      return;
    }
    try {
      const response = await fetch(`/api/adventurer-log/assets?q=${encodeURIComponent(value.trim())}`);
      const body = (await response.json()) as { matches: Match[] };
      if (seq === searchSeq.current) setMatches(body.matches ?? []);
    } catch {
      if (seq === searchSeq.current) setMatches([]);
    }
  }

  function insert(code: string) {
    const area = box.current;
    const start = area?.selectionStart ?? text.length;
    const end = area?.selectionEnd ?? text.length;
    const next = (text.slice(0, start) + code + text.slice(end)).slice(0, max);
    setText(next);
    requestAnimationFrame(() => {
      area?.focus();
      const at = Math.min(start + code.length, next.length);
      area?.setSelectionRange(at, at);
    });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    const error = await onSubmit(text);
    setBusy(false);
    if (error) {
      setStatus(error);
    } else {
      setText("");
      setPicking(false);
    }
  }

  return (
    <form className="al-composer" onSubmit={submit}>
      <textarea
        ref={box}
        rows={rows}
        maxLength={max}
        value={text}
        placeholder={placeholder}
        onChange={(event) => setText(event.target.value)}
        style={{ width: "100%", font: "inherit" }}
      />
      <div className="al-actions">
        <button type="submit" disabled={busy || text.trim() === ""}>
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        ) : null}
        <button type="button" onClick={() => setPicking(!picking)} aria-expanded={picking}>
          Add an item or skill
        </button>
        <span className="al-time">
          {text.length}/{max}
        </span>
        <span role="status">{status}</span>
      </div>
      {picking ? (
        <div className="al-picker">
          <input
            type="search"
            placeholder="Search items and skills"
            value={query}
            onChange={(event) => search(event.target.value)}
            autoFocus
          />
          <div className="al-picker-results">
            {matches.map((match) => (
              <button key={match.code} type="button" title={match.code} onClick={() => insert(match.code)}>
                {match.kind === "item" ? <ItemIcon id={match.id} size={24} /> : <SkillIcon stat={match.stat} size={20} />}{" "}
                {match.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </form>
  );
}
