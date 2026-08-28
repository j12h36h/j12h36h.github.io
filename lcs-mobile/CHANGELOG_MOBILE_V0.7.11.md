# LCS Mobile v0.7.11 — Auth persistence + header cleanup

- Removed the redundant text button named **Account** from the mobile header.
- Kept the signed-in account/profile control, sign-out control, and Account navigation destination intact.
- Mobile Firebase Auth is now initialized explicitly with `browserLocalPersistence`, then `browserSessionPersistence`, then memory fallback instead of relying on the default IndexedDB-first persistence selection.
- Google popup sign-in still starts directly from the user's tap.
- Desktop `/logicalcommunicationservice/` is not modified by this mobile package.
- No Firestore rule or index changes are required.
