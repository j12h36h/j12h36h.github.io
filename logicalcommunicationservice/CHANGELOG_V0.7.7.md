# LCS v0.7.7 — Mobile Google Auth Fix

- Moved Firebase `browserLocalPersistence` setup into application startup.
- Google sign-in now calls `signInWithPopup()` immediately from the user tap/click instead of awaiting persistence first.
- This preserves the browser user-activation window used by stricter mobile browsers to authorize popup creation.
- Kept the v0.7.6 referrer-policy fix for HTTP-referrer-restricted Firebase browser keys.
- Improved `auth/internal-error` guidance for mobile and in-app browsers.
- Bumped the app module cache key.

No Firestore rules or index changes are required.
