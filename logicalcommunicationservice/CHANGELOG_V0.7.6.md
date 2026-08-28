# LCS v0.7.6 — Google Sign-In Referrer Fix

## Fixed
- Replaced the main app page `Referrer-Policy: no-referrer` with `strict-origin-when-cross-origin`.
- This preserves path/query privacy for cross-origin requests while allowing Google Cloud HTTP-referrer browser-key restrictions to receive the site origin required to validate the Firebase Web API key.
- Improved `auth/internal-error` guidance in the sign-in dialog.
- Bumped browser asset cache keys so GitHub Pages clients do not keep the older v0.7.5 JavaScript/CSS.

## Firebase configuration
No Firestore rule or index change is required for this patch.

If the Firebase Web API key uses Website restrictions, allow at minimum:
- `https://j12h36h.github.io`
- `https://j12h36h.github.io/*`
- `https://logicalcommunicationservice.firebaseapp.com`
- `https://logicalcommunicationservice.firebaseapp.com/*`

Keep Identity Toolkit API and Token Service API in the API allowlist when API restrictions are enabled.
