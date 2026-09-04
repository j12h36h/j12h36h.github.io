// Shared E.R.A.S. live-presence configuration.
// Firebase Web App values are public client configuration, not secrets.
//
// IMPORTANT: If Realtime Database is created outside the default US region,
// replace databaseURL with the exact URL shown in Firebase Console.
export const SITE_PRESENCE_CONFIG = Object.freeze({
  firebase: Object.freeze({
    apiKey: 'AIzaSyAyoCH-n3rgJ1TgLRa_qxoef9sibggFYOE',
    authDomain: 'logicalcommunicationservice.firebaseapp.com',
    projectId: 'logicalcommunicationservice',
    appId: '1:752872197816:web:d13177e2b26f757438ee4d'
  }),
  databaseURL: 'https://logicalcommunicationservice-default-rtdb.firebaseio.com',
  rootPath: 'presence/v1/clients',
  heartbeatMs: 20000,
  staleAfterMs: 65000,
  firebaseVersion: '12.18.0'
});
