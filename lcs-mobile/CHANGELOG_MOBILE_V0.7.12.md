# LCS Mobile v0.7.12

- Replaced mobile Google popup sign-in with `signInWithRedirect()`.
- Switched mobile Firebase `authDomain` to `j12h36h.github.io` for same-origin auth helpers.
- Added redirect-result handling during Firebase startup.
- Restored standard browser Firebase Auth initialization and local persistence.
- Updated CSP to permit same-origin auth iframe usage.
- Added root helper-fetch scripts and deployment instructions based on Firebase's documented self-hosted helper option.
- Desktop `/logicalcommunicationservice/` is not modified.
