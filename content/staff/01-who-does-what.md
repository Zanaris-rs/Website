---
title: Who does what
---

<!-- Sources: engine ClientCheatHandler.ts (the level gates and the production
     gate), ReportAbuseHandler.ts (the level-1 mute box), lib/staff/level.ts
     (STAFF_MOD_LEVEL) and lib/staff/staff-server.ts (the per-request check). -->

Your account has a **staff level**, and it is the only thing that decides what
you can do. It is a number on the account, `staffmodlevel`, and everything
below follows from it.

| Level | Who | What it unlocks |
| --- | --- | --- |
| 0 | player | nothing |
| 1 | player moderator | the "mute for 48 hours" box on the in-game Report Abuse screen |
| 2 | moderator | `::ban`, `::mute`, `::kick`, `::track`, `::teleto`, `::setvis` and the rest of the level-2 commands; every staff page on this website |
| 3 | admin | all of the above, plus the commands that can move the economy |
| 4 | developer | only does anything on a world that is not production; on the live fleet it behaves as 3 |

The `admin` account is level 3. **Levels are set by the operator**, from the
command line, against the database. Nothing on this website changes anybody's
level, and there is no page that could.

### Where your level is checked

In game, at the moment you type the command. On the website, twice.

The staff pages need level 2 or higher, and the level is read out of the
database **on every request** — not out of your session cookie. The cookie
carries a username, an issue time and a fingerprint of your password salt, and
deliberately no level: a level in a cookie is one that would survive a
demotion for a week.

Then every staff action asks again, inside the database function itself. That
is why a page you can see is not the same as a thing you can do, and why the
two checks are not redundant: the page decides what you are *shown*, the
database decides what *happens*.

A signed-in player who is not staff is sent to the login form rather than
shown a "forbidden" page. To them, `/staff` looks exactly like it does to a
stranger, which is the point.

### The `::` commands

Type them into the game's chat box, like any other line.

`::ban`, `::mute`, `::kick`, `::teleto` and `::setvis` **only work on a
production world**, which every world on this fleet is. `::track` is the
exception and works anywhere, because it is the one command a developer needs
on a test world to see the capture path work end to end.

Every command you run at level 2 or above is written to the session log,
exactly as you typed it. Assume everything you do is recorded, because it is.

### What this handbook is

The ten sections below are the moderator's copy, and they are kept in step with
the code they describe. They are not the operator's runbook: lifting a
punishment that predates the public record, IP bans, level changes and account
audits are all done from the command line by the operator, and this handbook
says "ask the operator" where that is the answer.
