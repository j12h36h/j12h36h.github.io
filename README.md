# E.R.A.S. Website

Static GitHub Pages hub for E.R.A.S., LCS, DAI, the browser game, content, trading, and public assets.

## Canonical deployment files

- LCS client: `logicalcommunicationservice/`
- LCS mobile shell: `lcs-mobile/` (shares the canonical LCS app/config/assets)
- Firestore rules: `logicalcommunicationservice/firestore.rules`
- Firestore indexes: `logicalcommunicationservice/firestore.indexes.json`
- Firebase CLI config: `logicalcommunicationservice/firebase.json`
- Shared Chat UI: `assets/js/direct-messaging.js` + `assets/css/direct-messaging.css`

The site uses Firebase Web App configuration in browser code by design. It must never contain service-account JSON, OAuth client secrets, private keys, passwords, refresh tokens, or database exports. Restrict the public Firebase browser API key in Google Cloud to the required Firebase APIs and approved web origins.

`.nojekyll` is intentional: this repository is a static site and should be served without Jekyll-generated duplicate documentation pages.
