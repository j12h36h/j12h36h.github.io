# SpaceStories — E.R.A.S. Global Game Patch

Drop the contents of this ZIP into the root of `j12h36h.github.io` and allow the included files to merge/replace matching paths.

## Adds
- `/game/global/space-stories/` — complete SpaceStories Global mode.
- SpaceStories card as `GLOBAL // 011` on `/game/global/`.

## Gameplay
- Cute 2D space side-scroller / idle action RPG.
- 30 story stages across 6 themed zones.
- Boss encounter every fifth story.
- Manual movement, jump, attack, three active skills, and Auto Pilot.
- Level / XP progression.
- Randomized equipment with Common, Uncommon, Rare, Epic, and Cosmic rarity.
- Six equipment slots and a 30-item cargo hold.
- Equip-best and recycle-lower-gear actions.
- Permanent Starbits shop upgrades.
- Captain's Log progression rewards.
- Responsive desktop + mobile controls.
- Per-E.R.A.S.-profile browser save data.

## Global Lobby
- Mochi-9 Waystation lobby.
- Star map stage selector.
- Gear bay, orbital shop, pilot summary, and Captain's Log.
- Live world chat for signed-in E.R.A.S. profiles.
- World chat uses the existing `publicComments` Firebase path with a dedicated `object:spacestories-world-chat` target, so no Firestore security-rule weakening is required.
- Chat is permanently labeled public and warns players not to disclose private/sensitive information.

## Controls
- A / D or Left / Right — move
- Space / W / Up — jump
- J — Pulse Pop
- 1 — Nova Bubble
- 2 — Comet Dash
- 3 — Patch Pod
- E — toggle Auto Pilot

## Save behavior
Progression is saved locally per E.R.A.S. public profile ID under `eras:space-stories:v1:<profileId>`. World chat is live Firebase data shared across players.
