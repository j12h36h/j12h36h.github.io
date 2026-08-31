# LCS Mobile v0.9.12 — Direct Messaging + Live Browser Translation

ADDED
- Shared direct-message inbox for desktop LCS and mobile LCS.
- Direct-message access from accepted-friend profile/connection controls.
- The same direct-message system throughout the E.R.A.S. browser-game play flow: Play, Host, Join, Social, desktop Global, and mobile Play/Host/Join/Global.
- Shared Firestore thread/message format so conversations continue across LCS and the game.
- Message language metadata and optional live in-browser translation.
- Original message text remains the stored canonical text; generated translations are display-only.
- Persistent safety notice fixed to the bottom of the DM popup at all times.

DIRECT MESSAGE SAFETY NOTICE
Treat every direct message exactly like a public post or public message. Do not send your real name, address, phone/email, passwords, payment information, private account details, precise location, or anything you would not want publicly visible. Messages may be stored, reviewed, copied, shared, or become publicly accessible.

ACCESS / SAFETY RULES
- Starting or sending a DM requires an accepted LCS friendship.
- DMs use random public LCS profile IDs rather than Firebase Auth UIDs.
- Blocking or removing the friendship prevents new message writes.
- Current Firestore rules limit thread/message reads to participants, but the product deliberately makes no confidentiality promise and permanently tells users to treat DMs as public.
- Messages are immutable from the client after creation.

TRANSLATION
- Uses the browser Translator API when the browser supports it.
- User chooses the language they are writing in and the desired translation language.
- Unsupported browser/language pairs fall back to the original message.

DEPLOYMENT REQUIREMENT
Deploy the updated Firestore rules together with the static site. The new client messaging UI depends on the directMessageThreads rules in firestore.rules / firestore.v0918.rules.
