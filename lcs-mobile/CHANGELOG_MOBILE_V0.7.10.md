# LCS Mobile v0.7.10

## Top-right Account shortcut restored

- Restores a persistent **Account** button in the mobile header at the top right.
- The shortcut always opens the existing Account view whether signed in or signed out.
- Keeps the desktop LCS at `/logicalcommunicationservice/` completely untouched.
- Hides the redundant dynamic desktop-style auth pill from the mobile header to prevent crowding on narrow screens.
- Sign in and sign out remain available from the Account view.
- Bumps mobile CSS/JS cache keys so the restored control appears immediately after deployment.

No Firestore rules or indexes changed.
