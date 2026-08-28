# LCS v0.7.1 Security Architecture

## Core boundary
Sensitive provider identity stays in Firebase Authentication. LCS uses only the Firebase Auth UID as a private authorization key to locate the owner-only `privateAccounts/{uid}` mapping. Public LCS data uses a random public profile ID instead.

The application does not read or store Google email, Google account name, provider photo, `providerData`, passwords, OAuth access/refresh tokens, client secrets, service-account credentials, or private keys.

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
Public profiles may contain an `avatarJson` string capped at 32,000 characters. The browser never inserts raw avatar JSON as HTML. Avatar definitions are limited to 96 character layers. It parses the JSON, validates an allowlisted schema, clamps numeric ranges, restricts fonts/weights/alignment, validates six-digit hex colors, escapes character content, and emits its own SVG text elements. External URLs, uploaded images, raw SVG, raw HTML, raw CSS, and scripts are not part of the avatar schema. Invalid saved definitions fall back to initials.
