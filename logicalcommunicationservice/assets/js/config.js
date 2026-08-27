// Logical Communication Service configuration.
// Firebase web configuration values are PUBLIC client configuration, not secrets.
// Never place service-account keys, OAuth client secrets, or private keys in this file.

export const LCS_CONFIG = {
  appName: "Logical Communication Service",
  canonicalUrl: "https://j12h36h.github.io/logicalcommunicationservice/",

  // Paste the Firebase Web App config from:
  // Firebase Console -> Project settings -> Your apps -> Web app -> SDK setup and configuration.
  // The app automatically switches from local-demo mode to live realtime mode when apiKey/projectId/appId are present.
  firebase: {
    apiKey: "",
    authDomain: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
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
