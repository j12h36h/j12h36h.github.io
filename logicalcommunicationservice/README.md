# Logical Communication Service — v0.8.2

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



## v0.8.2 mobile session retention
- Firebase Auth local persistence is normalized during startup and again before Google account selection.
- Fixed the auth/Firestore startup race that could restore a valid Firebase user before Firestore was ready, leaving LCS permanently stuck while linking the separate public identity.
- After Firestore initializes, LCS now immediately re-applies any already-restored Firebase user and resumes the private UID → random public profile mapping.
- Google popup completion now verifies `auth.currentUser` before reporting success and refreshes the Firebase ID token once.
- Android `pageshow` and foreground/visibility return events re-check the persisted Firebase user after the Google account picker backgrounds the LCS tab.
- Private identity linking is promise-guarded to prevent duplicate mapping work during overlapping auth callbacks and mobile resume events.
- A dedicated `auth/session-not-retained` error is shown if Google account selection returns but Firebase actually has no retained browser session.

The primary mobile path remains popup + local Firebase persistence. The redirect fallback is retained only for popup failures because Firebase documents additional cross-origin storage requirements for `signInWithRedirect()` on apps hosted outside Firebase Hosting.

## v0.8.1 mobile Google authentication hardening
- Desktop keeps the existing Google popup sign-in path.
- Mobile also starts with popup sign-in, but automatically falls back to Firebase redirect sign-in for popup/internal browser failures.
- Redirect results are processed on startup and cannot loop indefinitely; a missing redirect credential is surfaced as a visible diagnostic.
- On mobile, before opening Google sign-in, LCS probes the public Firebase Auth project-config endpoint. This exposes browser-key HTTP-referrer/API restriction failures that Firebase can otherwise collapse into `auth/internal-error`.
- The old error text claiming LCS rewrites Firebase request referrers was removed. The browser remains responsible for the HTTP Referer header under the page's `strict-origin-when-cross-origin` policy.
- The auth error panel now reports the attempted path, page origin, configured auth domain/project, project-config probe result, HTTP status, and Firebase error message without displaying Google profile data, OAuth credentials, tokens, or the Firebase Auth UID.

### Required Firebase / Google Cloud settings
1. Firebase Authentication → Settings → Authorized domains: `j12h36h.github.io`.
2. Keep `authDomain` as `logicalcommunicationservice.firebaseapp.com` in `assets/js/config.js`.
3. If the browser API key uses Website restrictions, allow:
   - `https://j12h36h.github.io/*`
   - `https://logicalcommunicationservice.firebaseapp.com/*`
4. If API restrictions are enabled on that key, do not block the Firebase Authentication APIs (Identity Toolkit / Secure Token Service).

The website cannot change Google Cloud API-key restrictions from client code. When those external settings are wrong, v0.8.1 now reports the underlying project-config HTTP/status response instead of only `auth/internal-error`.
