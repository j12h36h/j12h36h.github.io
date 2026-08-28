# LCS v0.7.5 — Interaction / Live Context Fix

## Fixed
- Popup close controls now have direct listeners instead of relying only on document-level event delegation.
- Cancel / X controls reliably close their owning dialog; clicking the backdrop also closes a modal.
- Create Idea / Problem / Project now has an in-flight lock so repeated clicks cannot create duplicate records while the first Firestore write is pending.
- Successful object creation closes the create dialog immediately after Firestore acknowledges the write.
- Response submission now locks its button while writing and inserts the acknowledged response into the open discussion immediately.
- Open post/object discussions now receive their own scoped realtime Firestore subscription, so responses update live while the popup is open.
- Feed/catalog response counts refresh as comments arrive.
- Idea Map nodes now use the correct `node-idea`, `node-problem`, and `node-project` classes and explicit high-contrast text/background styling.

## Tags
- Added public Post Tags to the main composer.
- Commas, semicolons, newlines, and Enter can delimit tags.
- Inputs automatically normalize separators and display live tag chips.
- Tags appear on feed posts and inside post details.
- Object and LFG tag inputs use the same parser/preview behavior.

## Firebase
- `publicPosts` now supports an optional `tags` list (maximum 8).
- Existing posts without `tags` remain valid for moderation/update operations.
- Publish the included v0.7.5 Firestore rules before using tagged posts.
