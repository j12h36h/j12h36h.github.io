# Portal v1.8.1 — LCS Profile Trading Integration

Overlay this package at the repository root.

- Public LCS profile details now expose separate **Send Credits** and **Trade Assets** actions.
- Public profile directory, Friends, Followers, Following, and People search results have quick trading actions.
- `/trade/?with=<publicProfileId>&mode=credits` preselects the player and focuses direct Credit transfer.
- `/trade/?with=<publicProfileId>&mode=trade` preselects the player and focuses negotiated asset/Credit trading.
- Desktop and LCS Mobile use the same shared integration.
- Self and blocked profiles do not expose trade actions.
- Firestore rules remain v0.9.16; no rules update is required.
