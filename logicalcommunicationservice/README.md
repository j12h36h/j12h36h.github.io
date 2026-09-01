# Logical Communication Service (LCS)

LCS is the shared E.R.A.S. social/identity layer. Desktop and mobile use the same canonical Firebase client, public-profile model, Firestore rules, and Chat system.

## Architecture

Firebase Authentication UID (private) → `privateAccounts/{uid}` (owner-only) → random `publicProfileId` → public LCS data.

Public profile/content records never need Google email, Google account name, provider photo, OAuth tokens, service-account credentials, or private keys.

Authorization is enforced by `firestore.rules`, including Founder/Moderator/Member/Timeout Status, moderation retention/logging, friendships/blocks, LFG, Chat, browser-game state, and economy records.

## Chat

- Starting or sending a Chat requires an accepted friendship.
- Blocking/removing a friendship prevents new Chat writes.
- Firestore restricts Chat reads to thread participants.
- New threads are created only on the first send; selecting a friend does not probe/create an empty Firestore document.
- Chat bodies are escaped before HTML rendering; browser-generated translations are inserted as text, not HTML.
- Original Chat text is canonical; generated translations remain display-only.
- The safety notice remains visible and tells users to treat Chats like public communication and not disclose private information.

## Deploy

1. Publish the static repository to GitHub Pages. `.nojekyll` is intentional.
2. Firebase Console → Firestore Database → Rules: publish `firestore.rules`.
3. If indexes changed, deploy `firestore.indexes.json` using the included `firebase.json`.
4. Complete the one-time Founder setup in `FOUNDER_SETUP.md` if it has not already been done.
5. Firebase Authentication → Google must be enabled and `j12h36h.github.io` must be an authorized domain.
6. Restrict the public Firebase Web API key in Google Cloud to the required Firebase APIs and approved website/referrer origins.

LCS uses Firebase `GoogleAuthProvider` + `signInWithPopup()` directly on desktop and mobile. There is no Firebase-hosted provider-token bridge or custom OAuth token relay in the production site.

## Canonical files

- Client UI: `index.html`
- Client logic: `assets/js/app.js`
- Public Firebase Web config: `assets/js/config.js`
- Firestore rules: `firestore.rules`
- Firestore indexes: `firestore.indexes.json`
- Security architecture: `SECURITY.md`
- Avatar JSON reference: `AVATAR_JSON_REFERENCE.md`

The `/lcs-mobile/` route is only a mobile shell/override and intentionally reuses these canonical files instead of carrying duplicate app/config/rules copies.
