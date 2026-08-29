# Project E.R.A.S. : Universe

Static GitHub Pages package for **Project E.R.A.S. : Universe** — the **External Reality Access System**.

## Current pages

- `index.html` — main Universe navigation screen
- `information/index.html` — themed Information screen with Version 0.1, server status, online player placeholder, and three orbital asteroid/comet elements
- `options/index.html` — Options screen with Master, Music, and FX volume controls plus Low/High graphics selection; settings persist locally in the browser
- `social/index.html` — Social screen with Communities, Account, Connections, and Requests sections
- `content/index.html` — DAI-inspired Content Creator workspace with a Universe-style empty preview center, orbiting clickable definition nodes (hover to reveal names), content browser, inspector, JSON view, and resource library

## Deploy

Place the contents of this folder under the repository's `/game/` directory so the main page is available at:

`https://j12h36h.github.io/game/`

The Information node links to `/game/information/`, the Options node links to `/game/options/`, the Social node links to `/game/social/`, and the Content node opens `/game/content/`.

## v1.5.0 Global-turn tactical runtime
Global and hosted games now use a shared sixty-second turn marker. Movement remains realtime (WASD/arrows/touch/click-to-auto-move), but each player has a 40-unit movement allowance that refreshes at the global marker. Attack and interaction declarations queue for the next marker and may be cancelled before it arrives.

## v1.5.3 Rolling game log + readability
The Global tactical client now displays a rolling game log for the current declaration window plus the previous nine global marker windows. The existing `gameActions` documents are the persisted log source, and clients prune declarations older than the ten-window retention period so the action history does not grow forever. Visible turn numbers were removed; only the synchronized one-minute refresh countdown remains. Desktop player names, battlefield landmark names, objective labels, and the world title were enlarged for readability.

## v1.6.2 Combat resolution fix
Combat transactions are now imported directly from the Firestore SDK instead of depending on a possibly stale shared namespace object. At every global marker, living in-range Cache Slimes are snapshotted before queued player actions resolve; their retaliation then resolves from that snapshot, making attacks simultaneous. A one-HP slime can therefore be killed and still land the strike it committed at that marker.

## v1.7.0 Roaming slimes, Rest, PvP, and Global scoreboard
The two Cache Slimes now roam bounded areas of the Slime Yard while out of combat. A low-frequency elected-client transaction advances their shared Firestore coordinates, and roaming stops whenever a player enters combat range or a slime is the target of a queued attack.

Players now have a real **REST / FULL HEAL** action. Rest is only available before moving or declaring an action in the current global refresh and while the player is not in active combat. Rest immediately restores full HP, then locks movement and declarations until the next global marker.

Profile-target attacks now resolve as real PvP: one damage per successful attack, three HP per player, and a knockout respawns the defeated player at Global spawn without touching Universal Credits. Global PvE and PvP kill totals are stored as compact per-profile counters in `globalGameStats`. The left-side Global HUD shows both all-time leaderboards plus a PvP record derived from the same rolling ten-marker `gameActions` collection, so no separate unbounded PvP log is created.
