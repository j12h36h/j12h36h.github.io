# One-time Founder setup — LCS v0.6

This is intentionally **not** hardcoded to the display name `J12H36H`. Display names can be changed and copied by another user. Founder is instead bound to the random public LCS profile ID that is privately mapped to your Firebase sign-in.

## 1. Publish the v0.6 Firestore rules
Firebase Console → Firestore Database → Rules → paste `firestore.rules` → Publish.

## 2. Sign in to LCS
Open the Account page. Under **Private authentication boundary**, copy **Full public profile ID**.

It looks like a UUID, for example:
`00000000-0000-0000-0000-000000000000`

This is a public LCS identifier, not your email and not your Firebase Auth UID.

## 3. Create the private bootstrap document
Firebase Console → Firestore Database → Data.

Create/choose collection:
`systemPrivate`

Create document with document ID:
`founder`

Add exactly one string field:
- field: `profileId`
- value: paste your full public LCS profile ID

Save the document.

The website cannot read this document; v0.6 Firestore rules explicitly deny all client reads/writes to `systemPrivate`.

## 4. Refresh LCS while signed in
The client makes a one-time Founder bootstrap request. Firestore accepts it only when the caller's private account mapping resolves to the public profile ID stored in `systemPrivate/founder`.

A public **Founder** Status badge should then appear. The Moderation workspace becomes available and you can grant Status values to other public profiles.

## Security note
Do not put your Google email, Google account name, Firebase Auth UID, password, OAuth token, or any other provider credential into the founder bootstrap document or GitHub repository.
