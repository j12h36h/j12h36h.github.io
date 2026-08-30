# Root Portal Patch v1.8.3

Fixes two issues:

1. Quiet global refresh markers no longer mark the local player as being in combat. REST becomes available after a clean refresh once the player has disengaged, provided they did not move or declare an action during that refresh.
2. Player Credit transfers and trade creation now explicitly initialize the local wallet, inspect recipient wallet existence through authenticated economy reads, and use Firestore rules v0.9.17. Asset-only/zero-credit trades are no longer blocked by a missing wallet.

Publish `firestore_v0.9.17_eras_trade_rest_fix.rules` (or the included `logicalcommunicationservice/firestore.rules`) before testing transfers/trades.
