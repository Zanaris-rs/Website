---
title: Kick, track, teleport and visibility
---

<!-- Sources: engine ClientCheatHandler.ts — `::kick`, `::track` with
     TRACK_DEFAULT_MINUTES = 15 and TRACK_MAX_MINUTES = 60, `::teleto`,
     `::setvis`, and the session log written for every cheat at level 2+. -->

### Kick

```
::kick <username>
```

Logs the player out immediately and closes their connection. **Nothing is
written about them**: no punishment row, no notice, no record. They can log
straight back in.

It answers `Player 'x' has been kicked from the game.` when it worked and
`Player 'x' does not exist or is not logged in.` when it did not — which makes
it the way to check a spelling before you ban.

Use it to break up a situation while you decide whether it needs anything more.

### Track

```
::track <username> [minutes]
::track <username> 0
```

Starts a mouse capture on somebody nobody has reported.

- **The number is optional. Left out, it is 15 minutes.**
- **The ceiling is 60 minutes.** A larger number is silently reduced to 60; a
  watch worth more than an hour is worth typing `::track` again.
- **`0` stops it**: `No longer tracking 'x'.`, or `'x' was not being tracked.`
- **The player must be online.** If they are not, you get `does not exist or is
  not logged in` and nothing is filed.
- The name is normalised the way Report Abuse normalises it, so `::track Mod
  Matt` and a player's report against `mod_matt` land on the same capture
  rather than opening two.
- Tracking somebody who is already being tracked extends the window rather than
  starting again: `Already tracking 'x' - window extended to N minutes.`

**It files a report.** `::track` goes through the report path rather than
around it: a macroing report appears on `/staff/reports` **with your name on it
as the reporter**, and the evidence hangs off it like any other. That is the
point — what you saw is on a page somebody else can check.

So do not use it on a whim. Use it when you are watching somebody and no player
has reported them.

### Teleport to a player

```
::teleto <username>
```

Jumps you to where they are standing. `x is not logged in.` if they are not,
and `Please finish what you are doing first.` if you are in the middle of
something.

### Visibility

```
::setvis <level>
```

`0` is normal, `1` is soft and `2` is hard. Use it to watch without being
watched — and remember that a player who cannot see you can still see the
consequences of what you do.

### All of it is logged

Every `::` command run by an account at level 2 or above is written to the
session log with the exact text you typed. That is true of the harmless ones as
well as the serious ones, and it is the record that protects you when a
decision is questioned.
