---
title: The evidence
---

<!-- Sources: components/staff/StaffReportDetail.tsx (the evidence table, the
     200-chunk and 2,000-line notices, the flags, the "what they said" and
     "what changed hands" notes), StaffResolveForm.tsx (one capture per
     offender per fifteen minutes, and what dismissing deletes),
     lib/staff/macro/decode.ts (the flags) and the ops guide
     macro-moderator-guide.md for the windows the world captures. -->

When a player is reported for **macroing** or **bug abuse**, three things are
attached to the report. Every other reason leaves a row with no evidence behind
it.

| Evidence | What it is | Window |
| --- | --- | --- |
| input | the offender's mouse: movement, clicks and window focus | about 10 minutes *before* the report, then a 15-minute live tail after it |
| chat | the offender's own public chat, and the private messages **they sent** | 30 minutes before the report to 15 minutes after |
| wealth | trades, stakes, kills, deaths, drops, pickups, shop trades and alchemies | the same window, out of the 7 days kept for everybody |

The input capture is always running, in memory, for every player — a rolling
ring of about ten minutes that is overwritten and thrown away unless a report
lands. Nothing reaches the database until somebody presses Report Abuse. That
is what makes it worth reading: the recording starts before the moment that
mattered, not after it.

**No keystrokes are captured, ever.** The 2004 client does not send them, so
there is nothing to capture and nothing to leak. What it sends is the mouse: a
sample every 50 ms, each click with the time since the last sample, and whether
the game window had focus.

### One capture per offender per fifteen minutes

Later reports on the same player inside that window point at the same capture
rather than starting a second recording. This is the fact behind the dismiss
warning in *Report Abuse*, and it is worth holding on to: **reports are many,
evidence is one.**

### What you will not have

- **They logged out before the report** — chat and wealth only. No input, and
  no verdict.
- **A cross-world report** — a world only sees its own players, so there is no
  input. Chat and wealth still arrive.
- **A report in the first minute of a session** — a very short "before".
- **A Java client** — it sends at most one movement record per packet, so the
  capture has clicks and focus but almost no movement. The page flags it and
  the cursor signals are switched off.

### When the page has more than it showed you

Two reads have ceilings, and the page says so rather than presenting a part as
the whole:

- **Input stops at 200 chunks.** A long live tail arrives short, and the page
  prints "Only *N* of the *M* captured chunks were loaded. This verdict is
  about the part that was."
- **Chat stops at 2,000 lines.** A talkative offender in a long window arrives
  short, and the page says how many lines it is missing.

If either notice is on the page, the verdict underneath is about a fragment.
Read it as one.

### How long it lives

| Evidence | Kept |
| --- | --- |
| input and chat attached to a report | 30 days from the report — **or deleted the moment somebody dismisses it** |
| wealth events | 7 days, for everybody, reported or not |
| the punishment you issue | permanent, and public on `/bans` |

**When you are unsure, resolve as watch.** The report stays open, the evidence
lives out its 30 days, and a second report inside that window has something to
compare against. Dismissing is the only irreversible thing on the page.

### Evidence stays on the site

Read it on the report page. Do not copy input timings, chat lines or wealth
rows into a chat server, a ticket reply, a screenshot or anywhere else. What a
player is entitled to see about their own case is the notice and the public
record; the rest is not ours to publish.

### What is not on the page

- **No addresses.** The page answers the one question a moderator actually has
  — were the reporter and the offender at the same address, yes or no — and
  never shows an address. Who else registered from there, an address ban, an
  alt search: all of that is the operator's. Ask; do not guess from usernames.
- **No reason text.** There is none to show.
- **Only the messages they sent.** Their own public chat and their own private
  messages, in one direction. What other people said to them is not evidence
  about them and is not copied.
