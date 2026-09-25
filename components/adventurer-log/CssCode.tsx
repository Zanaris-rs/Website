"use client";

import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { cssLanguage } from "@codemirror/lang-css";
import { bracketMatching, HighlightStyle, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { type Diagnostic, lintGutter, lintKeymap, setDiagnostics } from "@codemirror/lint";
import { EditorState, type Text } from "@codemirror/state";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { type RefObject, useEffect, useImperativeHandle, useRef } from "react";

import type { Dropped } from "@/lib/adventurer-log/css";

import styles from "./CssEditor.module.css";

/**
 * The stylesheet box as a code editor: CodeMirror with CSS highlighting, line
 * numbers, bracket matching and the sanitiser's findings marked on their
 * lines. `CssEditor` imports this module only in the browser, after the page
 * has loaded, so CodeMirror is in no other page's JavaScript and the page
 * works as a plain textarea until (or without) it.
 *
 * The page owns the text. The editor reports every change and takes a new
 * text when the page replaces it ("Start from the 2004 skin").
 */

export type CodeHandle = {
  /** Put `text` where the cursor is, over any selection, with the cursor after it. */
  insert(text: string): void;
  focus(): void;
};

/** What the sanitiser made of one text: its findings belong to that text's lines. */
export type Lint = { text: string; dropped: readonly Dropped[] };

export type CodeProps = {
  value: string;
  onChange: (value: string) => void;
  lint: Lint;
  max: number;
  /** A change was refused because the text would be longer than `max`. */
  onTooLong: () => void;
  disabled: boolean;
  /** What the box is called, and the id of the words that say what goes in it. */
  label: string;
  describedBy: string;
  handle: RefObject<CodeHandle | null>;
};

// The site's colours: black panels, the grey text and borders of
// app/globals.css, and the account pages' yellow for what is being named -
// here, the properties.
const theme = EditorView.theme(
  {
    "&": {
      height: "22em",
      minHeight: "8em",
      resize: "vertical",
      overflow: "hidden",
      backgroundColor: "#000",
      color: "#fff",
      fontSize: "13px",
      border: "1px solid var(--panel-border)",
    },
    "&.cm-focused": { outline: "2px solid var(--link)", outlineOffset: "1px" },
    ".cm-scroller": {
      fontFamily: "ui-monospace, Menlo, Consolas, monospace",
      lineHeight: "1.5",
    },
    ".cm-content": { caretColor: "#fff" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#fff" },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      { backgroundColor: "#3d4250" },
    ".cm-gutters": {
      backgroundColor: "#111",
      color: "var(--text-muted)",
      borderRight: "1px solid var(--panel-border)",
    },
    ".cm-activeLine": { backgroundColor: "#161616" },
    ".cm-activeLineGutter": { backgroundColor: "#161616", color: "#ffe139" },
    "&.cm-focused .cm-matchingBracket": {
      backgroundColor: "#3b3616",
      outline: "1px solid #ffe139",
    },
    "&.cm-focused .cm-nonmatchingBracket": { backgroundColor: "#4a1010" },
    ".cm-tooltip": {
      backgroundColor: "#000",
      color: "var(--text)",
      border: "1px solid var(--panel-border)",
    },
    ".cm-diagnostic": { fontFamily: "Arial, Helvetica, sans-serif" },
    ".cm-diagnostic-warning": { borderLeftColor: "#ffe139" },
    ".cm-panels": { backgroundColor: "#111", color: "var(--text)" },
    ".cm-panels.cm-panels-bottom": { borderTop: "1px solid var(--panel-border)" },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: tags.propertyName, color: "#ffe139" },
  { tag: [tags.className, tags.constant(tags.className)], color: "#90c040" },
  { tag: [tags.tagName, tags.labelName, tags.attributeName], color: "#b4e060" },
  { tag: [tags.number, tags.unit], color: "#f0a860" },
  { tag: tags.color, color: "#8cc8ff" },
  { tag: tags.string, color: "#e8c890" },
  { tag: [tags.definitionKeyword, tags.keyword, tags.modifier], color: "#ff8f8f" },
  { tag: [tags.variableName, tags.operatorKeyword], color: "#9fd8d8" },
  { tag: [tags.atom], color: "#e4e4e4" },
  { tag: [tags.blockComment, tags.comment], color: "#8a8a8a", fontStyle: "italic" },
  { tag: [tags.punctuation, tags.separator, tags.brace, tags.paren, tags.squareBracket], color: "#b0b0b0" },
  { tag: tags.invalid, color: "#ff5050" },
]);

/** Each finding with a line, marked on the whole of that line. */
function diagnostics(doc: Text, dropped: readonly Dropped[]): Diagnostic[] {
  const out: Diagnostic[] = [];
  for (const item of dropped) {
    if (item.line === undefined || item.line < 1) continue;
    const line = doc.line(Math.min(item.line, doc.lines));
    out.push({
      from: line.from,
      to: line.to,
      severity: "warning",
      source: "Your log leaves this out",
      message: item.reason,
    });
  }
  return out;
}

export default function CssCode({
  value,
  onChange,
  lint,
  max,
  onTooLong,
  disabled,
  label,
  describedBy,
  handle,
}: CodeProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // The editor is made once; its listeners read the latest of these.
  const latest = useRef({ value, onChange, onTooLong });
  useEffect(() => {
    latest.current = { value, onChange, onTooLong };
  });

  useEffect(() => {
    const editor = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: latest.current.value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          lintGutter(),
          history(),
          drawSelection(),
          indentOnInput(),
          bracketMatching(),
          highlightActiveLine(),
          // The grammar alone: `css()` would add property completions, which
          // this editor does not offer, and their word list with them.
          cssLanguage,
          syntaxHighlighting(highlight),
          theme,
          EditorView.lineWrapping,
          // No Tab binding: Tab leaves the editor, as it leaves any other box
          // on the page.
          keymap.of([...defaultKeymap, ...historyKeymap, ...lintKeymap]),
          EditorState.readOnly.of(disabled),
          EditorView.editable.of(!disabled),
          EditorView.contentAttributes.of({
            "aria-label": label,
            "aria-describedby": describedBy,
            spellcheck: "false",
            autocorrect: "off",
            autocapitalize: "off",
          }),
          // The textarea's maxLength, for an editor that has none: a change
          // that would make the text longer than the limit is refused whole
          // (shortening an over-long text is always allowed).
          EditorState.transactionFilter.of((tr) => {
            if (!tr.docChanged || tr.newDoc.length <= max || tr.newDoc.length <= tr.startState.doc.length) {
              return tr;
            }
            queueMicrotask(() => latest.current.onTooLong());
            return [];
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) latest.current.onChange(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
  }, [describedBy, disabled, label, max]);

  // A text the page set rather than typed here.
  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const current = editor.state.doc.toString();
    if (current !== value) editor.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  // The findings are only drawn on the text they were found in. Typing after
  // it was sent means another answer is on its way; until then the marks
  // already drawn move with the edits.
  useEffect(() => {
    const editor = view.current;
    if (!editor || editor.state.doc.toString() !== lint.text) return;
    editor.dispatch(setDiagnostics(editor.state, diagnostics(editor.state.doc, lint.dropped)));
  }, [lint]);

  useImperativeHandle(
    handle,
    () => ({
      insert(text: string) {
        const editor = view.current;
        if (!editor) return;
        const { from, to } = editor.state.selection.main;
        editor.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
          scrollIntoView: true,
          userEvent: "input.paste",
        });
        editor.focus();
      },
      focus() {
        view.current?.focus();
      },
    }),
    [],
  );

  return <div ref={host} className={styles.code} />;
}
