# Logical Communication Service — v0.5

LCS v0.5 is the security/safety architecture release plus the first real social coordination layer.

## What changed
- Public Firebase Auth UIDs removed from the v0.5 data model.
- Provider name/email/photo are no longer read or displayed by LCS application code.
- Public identity uses a random public profile ID linked through an owner-only private account document.
- New public collections are isolated from legacy v0.4 UID-bearing collections.
- Legacy v0.4 data is quarantined from public reads; signed-in owners receive best-effort migration of their own records.
- Friend requests and accepted friendships are private participant-only records.
- Added owner-only profile blocks; blocked pairs cannot create new friend/LFG requests through Firestore rules.
- Public profile follows remain public social context but contain public profile IDs only.
- LFG supports Play Together, Create Together, and Share Information.
- LFG match requests are private participant-only records and the listing form has no private contact fields.
- Basic email/phone detection blocks accidental contact details in LFG descriptions/availability.
- CSP and no-referrer browser policy added to the LCS pages.
- Firebase client config reduced to the fields actually needed by this build.

## Deploy
1. Upload the website to GitHub Pages.
2. In Firebase Console → Firestore Database → Rules, replace the rules with `firestore.rules` and Publish.
3. Authentication → Sign-in method → Google must remain enabled.
4. Authentication → Settings → Authorized domains must include `j12h36h.github.io`.
5. If the Firebase Web API key uses Website restrictions, allow the GitHub Pages site and the Firebase authDomain used by the popup helper.

No Firebase Storage, Realtime Database, Cloud Functions, Analytics, or private server credentials are required for v0.5.
