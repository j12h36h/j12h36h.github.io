# LCS v0.6 — Status + Moderation / Retention

## Unified Status authorization
- Added **Founder**, **Moderator**, and **Timeout** as one Status authorization system.
- Status can be scoped **Globally**, to a **Discussion**, or to a **Project**.
- Founder is global-only and is the root Status administrator.
- Founder can grant/revoke Founder, Moderator, and Timeout Status.
- Moderators can moderate content within their assigned scope and can issue/revoke Timeout within that authority.
- Timeout makes covered contribution surfaces read-only while browsing remains available.
- Founder and Moderator badges can be public; Timeout is private to the affected profile and authorized moderation.

## Founder security
- Founder is **not** assigned by the public display name `J12H36H` because display names are editable and impersonable.
- The founding account is bound through a client-inaccessible `systemPrivate/founder` Firestore document containing only the random LCS public profile ID.
- The bootstrap founder cannot be revoked through the website Status system.

## Moderation workspace
- Added a moderation workspace for authorized Founder/Moderator profiles.
- Review visible and retained removed posts, ideas/problems/projects, comments, and LFG listings.
- Remove and restore content within the moderator's Status scope.
- Review active Status assignments and immutable moderation history.

## Retained deletion history
- Public posts, ideas/problems/projects, comments, and LFG listings now use soft deletion.
- The original public record is retained after deletion.
- Author delete/restore operations are committed transactionally with an immutable `author_remove` / `author_restore` log entry.
- Moderator remove/restore operations create immutable `remove` / `restore` log entries.
- Status grants/revocations create immutable `status_grant` / `status_revoke` log entries.
- Moderation logs cannot be edited or deleted by website clients.
- Deleted content is excluded from normal public Firestore queries; authorized moderation can still retrieve it.

## Privacy / security
- Public LCS records continue to use random public profile IDs rather than Firebase Auth UIDs.
- Google email/name/photo, provider data, OAuth tokens, and credentials are not read or written by LCS application code.
- Internal Status reasons for public Founder/Moderator assignments are retained in private moderation logs rather than copied into publicly readable Status records.
- Timeout assignment reasons remain private to the affected user and authorized moderation.
