# E.R.A.S. v1.7.3 — Global Clock Sync

Deploy `game/` and `game-mobile/` to the site root and publish `firestore_v0.9.15_eras_clock_sync.rules`.

The Global Refresh timer now calibrates against a unique per-tab Firestore server timestamp probe, re-syncs every five minutes, and re-syncs when the page returns from the background. Probe documents are deleted immediately after calibration.
