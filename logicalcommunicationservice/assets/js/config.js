// Logical Communication Service configuration.
// Firebase web configuration values are PUBLIC client configuration, not server secrets.
// Restrict the browser API key in Google Cloud; do not obfuscate it to evade secret scanning.
// Never place service-account keys, OAuth client secrets, or private keys in this file.

export const LCS_CONFIG = {
  appName: "Logical Communication Service",
  canonicalUrl: "https://j12h36h.github.io/logicalcommunicationservice/",

  // Paste the Firebase Web App config from:
  // Firebase Console -> Project settings -> Your apps -> Web app -> SDK setup and configuration.
  // The app automatically switches from local-demo mode to live realtime mode when apiKey/projectId/appId are present.
  firebase: {
    apiKey: "AIzaSyAyoCH-n3rgJ1TgLRa_qxoef9sibggFYOE",
    authDomain: "logicalcommunicationservice.firebaseapp.com",
    projectId: "logicalcommunicationservice",
    storageBucket: "logicalcommunicationservice.firebasestorage.app",
    messagingSenderId: "752872197816",
    appId: "1:752872197816:web:d13177e2b26f757438ee4d",
    measurementId: "G-DKXZF7T5F5"
  },

  // Optional moderation/display settings for the first public release.
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
