# LCS Mobile v0.7.9

This is a separate mobile build. It does **not** replace or modify `/logicalcommunicationservice/`.

Deploy this directory exactly as:

`/lcs-mobile/`

Live URL:

`https://j12h36h.github.io/lcs-mobile/`

## Firebase

No new Firestore rules or indexes are required beyond the v0.7.5+ LCS deployment.

The existing Firebase Authentication authorized domain remains:

`j12h36h.github.io`

If the Firebase browser API key uses HTTP-referrer restrictions, the existing rule:

`https://j12h36h.github.io/*`

already covers both `/logicalcommunicationservice/` and `/lcs-mobile/`.

## Mobile-specific changes

- Desktop LCS is untouched.
- Google sign-in is invoked directly from the original tap with no pre-popup `await`.
- Sign-in button is locked while an authentication attempt is in flight.
- Full-screen mobile dialogs.
- Fixed touch navigation bar with safe-area support.
- 44px minimum touch targets and 16px form controls to avoid iOS input zoom.
- Mobile map nodes use high-contrast dark surfaces and light text.
- Existing v0.7.6 functionality, including v0.7.5 live popup/reply/tag fixes, is retained.

## v0.7.11 header note
The mobile header includes a persistent top-right **Account** shortcut. Authentication controls themselves remain inside the Account view to keep the narrow mobile header stable.
