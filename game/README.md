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
