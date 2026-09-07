# SpaceStories — E.R.A.S. Global Game Patch

## Update 1.2.0 — Stories 31–50 + Rarity Safety + Gear Delete

Drop the contents of this ZIP into the root of `j12h36h.github.io` and allow the included files to merge/replace matching paths.

## Adds
- Single centered gameplay viewport with overlay-based UI.
- Cursor-style modular command buttons wrapped around the play window.
- Route, shop, gear, cargo, objectives, stats, help, and world chat now open as direct in-viewport popups.
- Lobby and game flow unified into one command-centered screen layout.
- `/game/global/space-stories/` — complete SpaceStories Global mode.
- SpaceStories card as `GLOBAL // 011` on `/game/global/`.

## Gameplay
- Cute 2D space side-scroller / idle action RPG.
- 50 story stages across 10 themed zones.
- Stories 31–50 add Star Candy Belt, Aurora Reef, Clockwork Constellation, and Event Horizon Nursery.
- Late-game difficulty ramps enemy HP, attack, defense, speed, and crowd size sharply after Story 30.
- Gear rarity now uses strict, non-overlapping global power bands: Common < Uncommon < Rare < Epic < Cosmic.
- Existing saved gear is normalized into its claimed rarity band when loaded.
- Every cargo item has EQUIP and DELETE buttons; DELETE requires confirmation and gives no Starbits.
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
