---
title: Report Abuse
---

<!-- Sources: engine ReportAbuseHandler.ts (REPORT_ABUSE_COOLDOWN = 30000, the
     identical reply either way, staff exempt at any level above 0, and the
     48-hour moderator mute box), ReportAbuse.ts (the twelve reason codes),
     lib/staff/format.ts (reportReasonLabel, STAFF_NOTE_MAX = 1000),
     lib/staff/queries.ts and app/staff/reports/page.tsx (?since=),
     components/staff/StaffReportDetail.tsx (the fields) and
     StaffResolveForm.tsx (the three resolutions and the dismiss warning). -->

A report is **an offender and a rule number**. That is the whole packet: the
2004 client has no box to type in, so there is never any text with a report,
and there never will be.

The rule number is one of the twelve on [the rules
page](/rules/original), and the reports list prints it as the rule it names — `7. Macroing`, `4. Cheating/Bug Abuse` — rather than as a
number. If a report needs context, ask the reporter to open a ticket.

### The cooldown

**One report per player per 30 seconds.** A second one inside that window is
thrown away, and the player is thanked for it exactly as if it had landed —
the reply is identical either way, on purpose, so a modified client cannot time
the window by watching what comes back.

**Staff accounts are exempt**, at any level above 0. The same screen is how a
player moderator mutes, and two mutes half a minute apart is an ordinary
afternoon in a bot raid rather than a flood.

### The 48-hour mute box

Level-1 player moderators have a **"mute for 48 hours"** tick on the Report
Abuse screen. The engine honours it only for staff accounts and only on a
production world, and the mute it writes is always 48 hours — there is no other
number.

It rides along with the report, so a report the cooldown threw away takes the
mute with it. Nothing is written: not the report, not the mute.

### The list

`/staff/reports` shows the last seven days, newest first, and says at the top
what window you are looking at. `?since=<ISO date>` widens or narrows it —
`/staff/reports?since=2026-09-01` — and anything unparseable falls back to the
week.

Each row carries the world, the reporter, the offender, the rule, where the
reporter was standing, whether evidence was kept, and how the report was
resolved. An unresolved one is highlighted; so is a row with evidence behind
it.

### The report page

Open a row and you get everything the world kept. The three fields worth
knowing about before you read the evidence:

- **Standing** — whether the offender is banned, muted or both right now, and
  until when, followed by how many times they logged in over the last 24 hours.
- **Address** — "the same address" or "different addresses", and nothing more.
  You never see an address itself. When there is no login to compare, the page
  says so and says it means nothing either way.
- **Resolution** — open, or what somebody decided and when.

### Resolving

Three choices, and all three ask for your password again:

- **Actioned** — the report was right and you did something about it. Say what,
  in the note.
- **Dismissed** — the report was wrong or unfounded. **This deletes the
  evidence immediately and permanently.**
- **Watch** — not proven either way. The evidence stays for its 30 days.

**Read this before you dismiss anything.** One capture covers every report filed
against that player inside the same fifteen minutes. Six people reporting one
macroer produce six reports and *one* copy of the evidence, so dismissing any
one of them deletes the evidence behind all six — including the report you
meant to keep. Dismiss the duplicates last, or resolve them as watched.

The note on a resolution is **staff-only** and never shown to the player. It
holds up to 1000 characters, so there is room to say what you actually thought.
If the player needs to be told something, that is a notice or a ticket reply,
not this box.
