# Logical Communication Service — GitHub Pages package

Target URL:

`https://j12h36h.github.io/logicalcommunicationservice/`

This package is intentionally a static GitHub Pages frontend with an optional Google/Firebase backend. It works immediately as a local interactive demo. Once Firebase is configured, it gains real Google authentication and realtime shared data through Cloud Firestore.

## 1. Install into j12h36h.github.io

Copy the entire `logicalcommunicationservice` folder into the root of the repository that publishes `j12h36h.github.io`, then commit and push it.

Expected structure:

```text
j12h36h.github.io/
├── ...existing site...
└── logicalcommunicationservice/
    ├── index.html
    ├── privacy.html
    ├── terms.html
    ├── firestore.rules
    ├── firebase.json
    └── assets/
```

GitHub Pages will then serve the site at the target URL.

## 2. Turn on real Google login + realtime data

The site uses the current modular Firebase Web SDK and Firebase Authentication's Google provider. No OAuth client secret or service-account key belongs in this repository.

### Create/connect Firebase

1. Open https://console.firebase.google.com/ and create or choose a project.
2. Add a **Web app** to that project.
3. Copy its public Firebase configuration object.
4. Open `assets/js/config.js` in this package.
5. Paste the values into `LCS_CONFIG.firebase`.

Example shape:

```js
firebase: {
  apiKey: "...",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "...",
  appId: "..."
}
```

These web configuration values identify the Firebase project; they are not server secrets. Do **not** add service-account JSON, OAuth client secrets, or private keys to GitHub.

### Enable Google authentication

In Firebase Console:

1. Go to **Security → Authentication → Sign-in method**.
2. Enable **Google**.
3. Go to Authentication settings / Authorized domains.
4. Add:

`j12h36h.github.io`

For local development, also authorize the localhost host you actually use.

Firebase's Google provider automatically uses the Google OAuth configuration associated with the Firebase project. The UI uses `signInWithPopup()` and falls back to redirect mode when a popup is unavailable.

### Create Firestore

1. In Firebase Console, create a Cloud Firestore database.
2. Start it with locked/production rules rather than open test rules.
3. Deploy or paste the included `firestore.rules`.

With Firebase CLI, from this folder:

```bash
firebase login
firebase use YOUR_FIREBASE_PROJECT_ID
firebase deploy --only firestore:rules
```

The included rules:

- allow public reads of public posts/objects;
- require authentication for creation;
- require `authorUid` to match the authenticated user;
- restrict updates/deletes to the author;
- validate post length, object length, reasoning types, and object kinds;
- deny undeclared collections by default.

## 3. Google/Firebase production checklist

Before treating this as a production public community:

- Replace the placeholder support/contact language in `privacy.html` and `terms.html`.
- Confirm the public home page, Privacy Policy, and Terms URLs in your Google/Firebase authentication branding settings.
- Configure an OAuth consent screen/branding as required by Google.
- Verify the site/domain ownership if Google requests production verification.
- Consider Firebase App Check before opening the database to significant traffic.
- Add moderation/reporting, content deletion, account deletion, abuse controls, rate limits, and administrative roles.
- Do not use a permissive `allow read, write: if true` Firestore rule in production.

## 4. Design model

The interface deliberately exposes plain language first:

| Plain language | Formal label | Meaning |
|---|---|---|
| I noticed | Observation | Something directly observed or recorded |
| We know | Premise | A starting fact/rule/agreed point |
| This follows | Deduction | A conclusion connected by reasoning |
| I'm assuming | Assumption | Treated as true but not established |
| Maybe | Hypothesis | A possible explanation or solution to test |
| I need to know | Question | Missing information |
| Just say it | Unclassified | Normal speech; no label required |

The formal model stays available without becoming an onboarding requirement.

## 5. Current v0.1 capabilities

- responsive browser UI;
- plain-language reasoning composer;
- idea / problem / project objects;
- visual idea map;
- project/space navigation;
- search and filtering;
- Google sign-in through Firebase Authentication when configured;
- Firestore realtime posts and objects when configured;
- safe local demo fallback when Firebase is not configured;
- baseline Firestore security rules;
- Privacy and Terms pages.

## 6. Important architecture boundary

GitHub Pages can host static client code, but it cannot itself securely execute trusted server logic. Firebase provides authenticated server-backed persistence for this package. Any future privileged features — administrator actions, secret API calls, private data processing, server-side AI, payment handling, etc. — should use a trusted backend such as Cloud Functions/Cloud Run rather than putting secrets in browser JavaScript.
