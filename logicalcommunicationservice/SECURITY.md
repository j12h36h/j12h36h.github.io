# LCS Security Architecture

## Core boundary
Sensitive provider identity stays in Firebase Authentication. LCS uses only the Firebase Auth UID as a private authorization key to locate the owner-only `privateAccounts/{uid}` mapping. Public LCS data uses a random public profile ID instead.

The application does not read or store Google email, Google account name, provider photo, `providerData`, passwords, OAuth access/refresh tokens, client secrets, service-account credentials, or private keys. Google sign-in uses Firebase popup authentication directly; no provider-token URL bridge is part of the production site.

## Public data
`publicProfiles`, normal public content, communities/channels, Helpful reactions, public follows, relationships, and open LFG listings are public by design. They contain public profile IDs only.

## Private data
The following are Firestore-rule protected:
- `privateAccounts` — owner-only UID → public profile mapping.
- `privateBlocks` — owner-only safety list.
- `privateFriendRequests`, `privateFriendships`, `privateLfgRequests` — participant-only social records.
- private Timeout Status assignments — visible only to the target and authorized moderation.
- `systemPrivate/founder` — never readable or writable by website clients.
- `moderationLogs` — authorized moderation only.

## Unified Status authorization
`statusAssignments` uses the same schema for Global, Discussion, and Project authority. Security decisions are enforced in Firestore rules, not merely hidden by the interface.

- Founder is global only.
- Founder may grant/revoke Status values.
- Moderator may moderate its assigned scope and may grant/revoke Timeout within that scope.
- Timeout prevents new contributions in its scope while retaining read access.
- The Founder bootstrap uses the private `systemPrivate/founder` document so public display-name impersonation cannot claim root authority.

## Deleted-content retention
LCS does not hard-delete public posts/objects/comments/LFG through the website.

A soft-deleted record retains the original public body plus:
- deletion state/time,
- the public profile ID responsible for removal,
- reason,
- moderation action ID.

Normal public queries exclude removed posts/objects. Authorized moderation can review retained records. This allows deletion/moderation disputes to be reconstructed without collecting additional private identity information.

Author self-deletion is marked as `self`; the content itself remains the historical record. Moderator removal/restoration must be committed in the same Firestore batch as an immutable moderation log entry. Firestore `getAfter()` checks enforce that relationship.

## Audit logs
`moderationLogs` is append-only. Client rules deny update/delete. Entries can contain only:
- moderator public profile ID,
- target public profile ID where applicable,
- public collection/document identifier,
- action and scope,
- moderator-entered reason,
- snapshot of the already-public content or Status metadata,
- timestamp.

They cannot contain provider identity fields or Firebase Auth UID fields under the v0.7.1 schema.

## Repository boundary
Safe to commit: HTML/CSS/JS, public Firebase Web App configuration, Firestore rules, documentation.

Never commit: service-account JSON, OAuth client secrets, private keys, passwords, access/refresh tokens, Firebase exports, private social records, moderation database exports, Google account information, or Auth UID mappings.

## Legacy quarantine
Old UID-bearing v0.4 collections remain non-public. A signed-in owner may privately migrate/delete only their own legacy records.

## Optional future hardening
Firebase App Check and a trusted server/Cloud Function layer can later add anti-automation controls, server-generated audit signatures, retention policies, and automated abuse handling. They are not required for the current v0.6 authorization model.


## JSON character avatar safety
Public profiles may contain an `avatarJson` string capped at 32,000 characters. The browser never inserts raw avatar JSON as HTML. Avatar definitions are limited to 96 character layers. It parses the JSON, validates an allowlisted schema, clamps numeric ranges, restricts fonts/weights/alignment, validates six-digit hex colors, escapes character content, and emits its own SVG text elements. v0.7.3 also permits bounded numeric `scaleX`, `scaleY`, `skewX`, and `skewY` values. The client constructs the resulting SVG transforms itself; raw SVG/CSS transform strings are never accepted. External URLs, uploaded images, raw SVG, raw HTML, raw CSS, and scripts are not part of the avatar schema. Invalid saved definitions fall back to initials.


## Chat boundary
Chats are stored under deterministic participant thread IDs. Firestore requires an accepted friendship, rejects blocked pairs, restricts reads to participants, validates sender/recipient membership, caps text at 2,000 characters, and makes chat records client-immutable after creation. Thread and chat creation timestamps use `request.time` so clients cannot forge server chronology. The UI permanently warns users to treat Chats like public communication and not disclose private information.

## Browser API key
The Firebase Web API key is public client configuration, not a server secret. It should be restricted in Google Cloud to the Firebase APIs this site uses and to approved website/referrer origins. Service-account keys and other privileged credentials must never be placed in the repository.

## Zero-trust public-client model
The production repository, Firebase Web configuration, collection names, request shapes, and Firestore rules are treated as public information. The browser is not a security boundary. A modified client, direct Firebase SDK client, or Firestore REST caller receives no authority beyond what Firestore Security Rules allow for the authenticated account.

Security-sensitive writes use strict schemas, immutable identity fields, `request.time` for authoritative chronology, and `getAfter()`/atomic transaction checks where a valid operation spans multiple documents. Completed settlement/receipt records are append-only or immutable.

## Credits and economic integrity
Global Credit balances cannot be increased by an arbitrary wallet update. Economic events must match one of the allowlisted settlement types and, where applicable, the corresponding transaction, purchase, reward receipt, inventory transition, or counterparty wallet transition in the same atomic write.

Global PvE rewards use immutable `globalRewardReceipts`. A reward receipt is tied to a resolved Global enemy-kill action, the exact enemy transition, the caller's stats increment, and the exact +1 Credit wallet settlement. Deleting/pruning a historical action does not make the economic reward reusable.

Official free Marketplace claims use deterministic holding document IDs derived from profile + asset ID. Legacy `assetInventory` writes are closed. Tradable ownership lives in `assetHoldings`, and ownership changes are accepted only through validated trade settlement transitions.

## Global gameplay integrity
The Global world uses server-time shared turns. Global action declaration reserves authoritative energy in the same atomic transaction as the queued action. Movement/presence updates are constrained by the authenticated profile, world, server turn, movement budget, elapsed server time, velocity and protected combat fields. Global combat results must match the target's corresponding authoritative state transition.

Global slime rewards and weapon variance do not use a client-selected UUID/random seed. Loot derives from the server-validated lifetime PvE kill sequence; supported Global weapon variance derives from the shared server turn. This removes the ability to search client-generated action IDs for favorable economic outcomes.

North Terminal item trading requires the authenticated player's current authoritative Global presence to be alive and within the allowed terminal radius. Hosted-world local currency and scores have no write path into global Credit wallets or global asset ownership.

## Hosted paid-access integrity
Paid hosted-game membership is represented by a short server-time lease on the lobby membership document. Starting or renewing a lease must atomically consume the appropriate authoritative entitlement capacity (play, life, or playtime) unless the entitlement is permanent. A stale membership document is not sufficient authorization for paid hosted game state.

The host and free lobbies use bounded free leases for the same membership shape. Hosted entitlements can only decrease their consumable capacity after purchase; clients cannot increase plays, lives, seconds, permanence, seller, lobby, or asset-license contents.

## Important boundary: hosted simulation fairness
Firestore-only rules protect global Credits, global ownership, authorization, purchases and the hardened Global economy/gameplay transitions. Generic hosted-game scores and some local simulation/physics state are intentionally sandbox-local and do not become global economic authority. Fully cheat-proof arbitrary custom physics or secret random outcomes would require dedicated per-mode transition rules or a trusted execution service. This boundary prevents hosted client manipulation from minting global Credits/assets even when the hosted simulation itself is not ranked-authoritative.
