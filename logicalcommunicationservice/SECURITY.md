# LCS v0.5 Security Architecture

## Goal
LCS public data must never contain Firebase Auth UIDs or Google/provider personal information. Provider authentication stays behind Firebase Authentication; LCS public identity is a separate random identifier.

## Identity boundary

Firebase Authentication UID (private)
→ `privateAccounts/{uid}` (owner-only)
→ random `publicProfileId`
→ `publicProfiles/{publicProfileId}` (public)

The application never reads or stores Google email, Google account name, provider photo, passwords, OAuth access/refresh tokens, client secrets, service-account credentials, or private keys.

## Public collections
`publicProfiles`, `publicPosts`, `publicObjects`, `publicSpaces`, `publicChannels`, `publicComments`, `publicReactions`, `publicFollows`, `publicConnections`, `publicPostLinks`, and `publicLfg` are public by design. They use public profile IDs only.

## Private collections
`privateAccounts`, `privateBlocks`, `privateFriendRequests`, `privateFriendships`, and `privateLfgRequests` are protected by Firestore rules. Reads require the signed-in Firebase account to map to the owner/participating public profile ID. Block rules also prevent new friend/LFG requests across a blocked pair.

## Legacy quarantine
The old v0.4 collections (`users`, `posts`, `objects`, `spaces`, `channels`, `comments`, `reactions`, `follows`, `connections`, `postLinks`) can contain Firebase Auth UIDs and copied identity fields. v0.5 rules remove public access to those collections. A signed-in owner may read/delete only their own legacy records while the v0.5 client performs best-effort migration into the new public-ID schema.

## GitHub repository
Safe to commit: static code, CSS, HTML, public Firebase Web App configuration.
Never commit: service-account JSON, OAuth client secrets, private keys, access/refresh tokens, passwords, database exports, user account data, or moderation/private request exports.

## Required Firebase deployment
Publish `firestore.rules` from this directory after deploying v0.5. The site is intentionally incompatible with the v0.4 public-UID rules.

## Optional hardening
Firebase App Check can be enabled later to reduce automated abuse of Firebase endpoints. It is defense-in-depth and does not replace Firestore rules.
