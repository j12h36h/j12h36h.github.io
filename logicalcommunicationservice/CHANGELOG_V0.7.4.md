# LCS v0.7.4 — Create + realtime reliability

- Fixed Idea / Problem / Project creation so Firebase failures are shown in the create dialog instead of disappearing into the browser console.
- Create buttons now enter a bounded `Creating…` state and always recover after success or failure.
- Newly created work is inserted optimistically into the local catalog immediately after Firestore acknowledges the write.
- Optional starting-connection failures no longer make a successfully created item look like creation failed.
- New items default to the matching Open Commons channel (`#ideas`, `#problems`, `#projects`) unless the user is already inside a specific channel.
- Legacy virtual channels are detected before writing and produce an actionable message instead of a Firestore permission failure.
- Realtime public subscriptions automatically fall back to an index-free filtered query when a composite index is still building or missing.
- Added `firestore.indexes.json` and wired it into `firebase.json` for production-scale composite indexes.
- Corrected generic backend errors so missing indexes are no longer mislabeled as missing Firestore rules.
