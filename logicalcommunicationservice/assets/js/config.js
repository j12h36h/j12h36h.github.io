// Logical Communication Service configuration.
// Firebase web configuration values are PUBLIC client configuration, not server secrets.
// Restrict the browser API key to Firebase-related APIs. If Website/HTTP-referrer restrictions are used,
// allow BOTH the GitHub Pages host and this Firebase authDomain because desktop popup auth and the mobile auth bridge use them.
// Recommended Website referrer patterns: https://j12h36h.github.io/* and https://logicalcommunicationservice.firebaseapp.com/*.
// If API restrictions are enabled, Firebase Authentication needs Identity Toolkit and Secure Token Service access.
// Do not obfuscate the key to evade secret scanning.
// Never place service-account keys, OAuth client secrets, or private keys in this file.

export const LCS_CONFIG = {
  appName: "Logical Communication Service",
  canonicalUrl: "https://j12h36h.github.io/logicalcommunicationservice/",

  // Paste the Firebase Web App config from:
  // Firebase Console -> Project settings -> Your apps -> Web app -> SDK setup and configuration.
  // This production build requires Firebase for shared authentication and realtime network data.
  firebase: {
    apiKey: "AIzaSyAyoCH-n3rgJ1TgLRa_qxoef9sibggFYOE",
    authDomain: "logicalcommunicationservice.firebaseapp.com",
    projectId: "logicalcommunicationservice",
    appId: "1:752872197816:web:d13177e2b26f757438ee4d",
  },

  // Public client behavior only. No provider PII, tokens, secrets, or private account data belong in this repository.
  allowedReasoningTypes: [
    "unclassified",
    "observation",
    "premise",
    "deduction",
    "assumption",
    "hypothesis",
    "question"
  ],
  maxPostLength: 1200,
  maxObjectDescriptionLength: 700
};
