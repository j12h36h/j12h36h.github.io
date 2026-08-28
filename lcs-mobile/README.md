# Logical Communication Service — v0.7.6

LCS v0.7.3 keeps the unified **Status** authorization system and a retained moderation/audit architecture on top of the v0.5 private-auth/public-identity boundary.

## Status, not roles
One authorization model is used at different scopes:
- **Global** — applies across LCS.
- **Discussion** — applies to one post discussion or one idea/problem/project discussion.
- **Project** — applies to a project and its discussion context.

Built-in Status values:
- **Founder** — global root stewardship and Status administration.
- **Moderator** — moderation authority in its assigned scope.
- **Timeout** — read-only contribution state in its assigned scope. Browsing remains available. Global Timeout blocks new network contributions while preserving safety actions such as blocking/unblocking.

Founder and Moderator may be shown publicly as badges. Timeout is private to the affected account and authorized moderators.

## Moderation retention
- Public posts, ideas/problems/projects, comments, and LFG listings use **soft deletion** instead of destructive deletion.
- Removed content disappears from normal public views but remains stored so authorized moderation can review the original public material later.
- Moderator remove/restore operations and Status grants/revocations create **append-only Firestore moderation logs**.
- Moderation logs store public profile IDs and snapshots of the already-public content involved in the action. They do not store Firebase Auth UIDs, Google email/name, OAuth tokens, or provider credentials.
- Moderation logs cannot be edited or deleted by the website client.

## Identity boundary
Firebase Authentication UID (private)
→ `privateAccounts/{uid}` (owner-only)
→ random `publicProfileId`
→ public LCS data.

The website does not read or publish Google account name, email, photo, provider data, access/refresh tokens, passwords, service-account credentials, or private keys.

## Founder bootstrap
Do **not** assign Founder by the display name `J12H36H`: display names are public and editable, so that would be impersonable.

v0.6 securely binds the founding account through a private Firestore bootstrap document containing only the account's random **public LCS profile ID**. Follow `FOUNDER_SETUP.md` once after deploying the v0.6 rules. No Google email or Firebase Auth UID is needed.

## Deploy
1. Upload the `logicalcommunicationservice/` directory to the same path in the GitHub Pages repository.
2. Firebase Console → Firestore Database → Rules: replace the rules with `firestore.rules` and **Publish**.
3. Complete the one-time founder bootstrap in `FOUNDER_SETUP.md`.
4. Authentication → Sign-in method → Google must remain enabled.
5. Authentication → Settings → Authorized domains must include `j12h36h.github.io`.
6. If the Firebase Web API key uses Website restrictions, allow the GitHub Pages site and the Firebase `authDomain` used by the popup helper.

No Firebase Storage, Realtime Database, Cloud Functions, Analytics, or private server credentials are required for v0.6.


## v0.7.3 JSON character avatars
Click the public profile image on Account to edit the current avatar JSON. The editor validates and previews changes live, then stores the canonical JSON string in the public profile. No image file, external URL, SVG input, HTML, or CSS input is accepted. Rendering uses only an allowlisted set of character-layer properties.


### v0.7.3 avatar capacity
- Up to 96 character layers per avatar.
- Up to 32,000 canonical JSON characters.
- Bounded in-browser SVG render cache for repeated complex avatars.


### v0.7.3 multilingual character support

Avatar layers accept visible Unicode grapheme characters from non-English writing systems in addition to English/ASCII symbols. The renderer continues to use only built-in browser/system fonts; no font files or remote font resources are accepted. `system-ui` was added to the font allowlist for stronger international glyph fallback.


## v0.7.3 glyph deformation
- Avatar layers can now be non-uniformly stretched with `scaleX` / `scaleY`.
- Negative scale values mirror glyphs horizontally or vertically.
- `skewX` / `skewY` shear glyphs by up to 75 degrees for cleaner custom geometry.
- Transform values are numeric, bounded, and validated; arbitrary SVG/CSS transform strings remain forbidden.
- Existing avatar JSON definitions remain compatible because all new transform fields are optional.


## v0.7.6 Google sign-in compatibility
The main app now uses `strict-origin-when-cross-origin` rather than `no-referrer`. This allows Firebase/Google browser API key HTTP-referrer restrictions to validate the GitHub Pages origin without exposing the app path or query string cross-origin.
