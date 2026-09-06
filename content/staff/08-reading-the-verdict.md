---
title: Reading the verdict
---

<!-- Sources: lib/staff/macro/verdict.ts (VERDICT_HEADLINES, the family
     grouping, the rules in the order adjudicate() applies them, the touch and
     withheld brakes, and every signal's label, detail and false positive),
     lib/staff/macro/metrics.ts (MIN_CLICKS_FOR_TIMING = 30,
     MIN_INTERVALS_FOR_RUNS = 50, MIN_CLICKS_FOR_SPATIAL = 10) and
     components/staff/StaffReportDetail.tsx (FAMILY_LABELS and FLAG_TEXT). -->

A report with input on it gets a verdict, and then the numbers behind it.

**The verdict is a prompt, not a decision.** It is arithmetic on a mouse trace.
You are the one accountable for the ban.

| Headline | What it means |
| --- | --- |
| **Likely macro** | families that measure different things agree. Ban with confidence — after you have read the flags and the chat. |
| **Review** | one family reads as mechanical, or several signals sit between a person and a program. Look at everything else first. |
| **Human-like** | nothing in the input looks mechanical. This is evidence *for* the player. |
| **Not enough data** | nothing could be measured. |

**"Not enough data" is a verdict, not a failure.** A short capture, a quiet ten
minutes, a Java client — all of them land here, and the honest answer is that
we do not know. It does not mean "probably guilty because the system could not
tell". If you still believe something is wrong, `::track` them for a longer
window and get a real sample.

### The three families

The signals are grouped into **Timing**, **Cursor** and **Focus**, and the
verdict asks for agreement *across* families rather than a majority within one.
That is not decoration. A fixed click interval makes the spread nearly zero,
the commonest interval enormous and the unbroken rhythm as long as the capture:
three signals, one observation. Counting those as three agreeing witnesses is
exactly how you ban somebody for clicking a bank booth in a rhythm.

### The rules, in the order they are applied

1. Nothing measurable at all — **Not enough data**.
2. Any click while the game window did not have focus — **Likely macro**. A
   person cannot click a window they are not looking at.
3. Bot-like on **two or more timing signals and at least one cursor signal** —
   **Likely macro**.
4. Bot-like on **three or more signals spanning at least two families** —
   **Likely macro**.
5. **One bot-like signal** — **Review**.
6. **Three suspicious signals** — **Review**.
7. Otherwise — **Human-like**.

### The three brakes

- **A touch-like stream never goes above Review**, whatever its numbers say:
  taps with no cursor between them, landing all over the screen, at a person's
  uneven pace. A phone has no cursor to measure, and a macro that looked
  exactly like one would be indistinguishable. (A stream with mechanical timing
  or an unfocused click is not counted as touch-like, so this is not a way out.)
- **The cursor family is not judged at all** for a **Java client** or a
  **throttled tab**. Neither is sampling the mouse the way the signals assume,
  and a number computed from samples nobody took is not evidence — it is an
  artefact, and it would always point the same way.
- **The focus family is withheld, and the verdict capped at Review**, for a
  capture with a hole in it: one the flood cap truncated, or one whose last
  record ran off the end. Focus is a *state* carried between records, so a lost
  "focus regained" record makes every click after it look like a click into a
  window nobody was watching — the one signal that convicts on its own. Losing a
  record must not manufacture the evidence.

The page prints the reason a family was withheld against that family, so a
verdict with something missing says what.

### Before a signal means anything

- **30 intervals** before any timing signal is computed.
- **50 intervals** before the unbroken-rhythm signal is.
- **10 clicks** before any cursor signal is.

Below those, the signal reads "Not enough data" and is not counted.

### The signals, and what an honest player does to set them off

Every row on the page carries its own false positive. These are the same ones,
in the same words, so you can read them before you open a report rather than
after you have decided.

**Timing**

- **Click interval spread** — how much the time between clicks varies, as a
  fraction of the average. *A player doing one repetitive thing — fishing,
  alching, an agility lap — clicks in a real rhythm. What a hand cannot do is
  hold it to the sample for hundreds of clicks.*
- **Commonest interval** — the share of intervals sitting on one exact value.
  *Actions paced by the game's own 600 ms tick genuinely pile onto one
  interval.*
- **Longest unbroken rhythm** — consecutive intervals within one 50 ms sample of
  each other, with a gap of more than five seconds ending the run. *A run of a
  dozen is ordinary; it is the run that never breaks — through a chat message, a
  dropped item, somebody walking past — that no person produces.*
- **Break regularity** — the spread of the gaps longer than five seconds. *A
  player who pauses for the same reason every time — a bank run, a respawn —
  pauses regularly. Breaks that are identical and clicks that are identical is
  the pair that matters.*

**Cursor**

- **Repeated pixels** — clicks landing on a pixel another click already used. *A
  fixed interface target — the bank's Deposit button, a spell in the book — is
  honestly the same pixel every time.*
- **Spread inside the busiest square** — how far the clicks inside the most-used
  16 px square sit from its centre. *A small target leaves little room to vary,
  and a steady hand on a trackball is genuinely tight. Zero is the number no
  hand produces.*
- **Clicks with no approach** — clicks the cursor reached in one hop of more than
  40 pixels rather than by travelling. *A fast flick ends in a long sample, and
  a capture that lost move packets leaves real journeys looking like jumps. A
  hand decelerates into a target.*
- **Cursor samples per click** — how much the mouse moved between clicks. *A
  touchscreen has no cursor between taps at all. This is the signal the touch
  brake exists for.*
- **Stillness around a click** — the spread of how long the cursor sat still
  either side of a click. *Muscle memory on one target produces a fairly
  constant pause. It does not produce the same pause on targets at different
  distances.*
- **Straight-line journeys** — journeys whose path is the straight line between
  their ends, within two pixels. *A mouse dragged along a screen edge travels
  straight honestly — which is why journeys under twenty pixels are not counted
  at all.*

**Focus**

- **Clicks with the window unfocused** — clicks the client reported while the
  applet did not have focus. *The applet reports its own focus, not the
  desktop's: a notification that steals focus and gives it back can land one
  click on the wrong side of the line. One is a coincidence. A session of them
  is a program clicking a window nobody is looking at.*

### The flags

The page marks a capture rather than silently scoring it. Read them first: a
verdict with a flag on it is a different verdict.

- **java client** — at most one movement record per packet. Cursor signals off.
- **throttled** — the mouse sampler was running far slower than 50 ms, which is
  a background tab. Cursor signals off.
- **flooded** — the client sent more than 8 KB of input in 100 ticks and the
  rest of that window was thrown away. Focus withheld, verdict capped at Review
  — and the flood itself is worth a look, because a normal client does not
  produce that volume.
- **truncated** — a chunk ended in the middle of a record. Same treatment.
- **unknown cursor** — part of the capture has no cursor position to start from.
- **dropped move** — a move packet was too long to frame and was dropped. Clicks
  around it can look like they arrived with no cursor.
- **ring wrapped** — chunks older than this capture were dropped before the
  report arrived.

### Deciding

1. Read the verdict, then the flags, then the signals table.
2. Read the chat around the report. A player answering questions in the middle
   of a "macro" is usually not one; silence for two hours proves nothing on its
   own.
3. Look at what changed hands. What a macro is *for* is usually visible there.
4. Decide, and resolve the report — actioned, dismissed or watch.
5. Ban with `::ban <username> <minutes>`. It is on `/bans` the moment it is
   written.
6. If they appeal, the ticket and the evidence are both still there while the
   30 days last. Decide it on the evidence, not on the verdict line.
