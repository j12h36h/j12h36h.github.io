# Logical Communication Service — v0.4 communities + channels build

Target URL:

`https://j12h36h.github.io/logicalcommunicationservice/`

LCS is a static GitHub Pages frontend backed by Firebase Authentication and Cloud Firestore. This build removes the seed/demo content and replaces the previously staged UI actions with live Firestore-backed behavior.

## What is functional in v0.4

- persistent Google/Firebase sign-in across page refreshes;
- public-profile saving with bounded completion time, Firebase acknowledgement, and realtime verification;
- privacy-first public profiles with editable display name and bio;
- Google email/provider identity kept out of public profile documents;
- public realtime post feed;
- reasoning labels for posts and discussion responses;
- post category selection: idea, problem, or project;
- public communities with live creation and filtering;
- persisted Firestore-backed channels inside communities;
- channel types for discussion, ideas, problems, projects, research, releases, and announcements;
- channel-specific feed/catalog/map filtering;
- new communities automatically receive a real `#general` channel;
- compatibility view for communities created before channels existed;
- realtime ideas, problems, and projects;
- functional Helpful reactions;
- functional Follow actions for work and public profiles;
- post-to-work connections;
- work-to-work relationships;
- realtime discussion threads on posts and work objects;
- object detail and public profile detail dialogs;
- live idea map using actual work and actual relationships;
- computed trending tags/connection types rather than fixed examples;
- search across people, posts, work, communities, and channels;
- global community and channel filters across feed/catalog/map;
- DAI Universe navigation preserved.

There is no local demo dataset in this build. If Firebase is unavailable, LCS reports the backend problem instead of silently replacing live data with example content.

## Firebase setup

The checked-in Firebase Web App configuration is browser client configuration. Never add service-account JSON, OAuth client secrets, or private keys to this repository.

In Firebase Console:

1. Enable **Authentication → Google**.
2. Under Authentication **Authorized domains**, include `j12h36h.github.io`.
3. Create a Cloud Firestore database.
4. Deploy the included `firestore.rules`.

If the Firebase Web API key has HTTP-referrer restrictions, allow the GitHub Pages host and the Firebase Authentication helper domain used by this project.

## Deploy Firestore rules

From this folder with Firebase CLI:

```bash
firebase login
firebase use logicalcommunicationservice
firebase deploy --only firestore:rules
```

The v0.4 build requires the included Firestore rules because channels and the new `channelId` content field are now part of the live schema. The rules cover these collections:

- `users`
- `posts`
- `objects`
- `spaces` (community records; retained for backward compatibility)
- `channels`
- `comments`
- `reactions`
- `follows`
- `connections`
- `postLinks`

Unknown collections are denied by default.

## Public identity model

Google/Firebase authenticates the account. LCS separately stores the public profile under `users/{firebaseUid}`. The public profile contains only:

- chosen display name;
- optional public bio;
- whether the user opted into their Google profile image;
- public image URL when opted in;
- created/updated timestamps.

The Google account name and email are displayed only to the signed-in user on the Account page and are not written into public Firestore profile documents.

## Architecture boundary

GitHub Pages cannot safely execute privileged server logic. Authentication and public persistence are delegated to Firebase. Features that require trusted moderation/admin authority, private server processing, secret API credentials, payments, or privileged deletion should be implemented with a trusted backend such as Cloud Functions or Cloud Run rather than browser JavaScript.
