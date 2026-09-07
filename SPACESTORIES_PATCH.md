# SpaceStories — E.R.A.S. Global Game Patch

## Update 1.3.0 — Stories 51–60 + Late-Game Hard Breakpoint

Drop the contents of this ZIP into the root of `j12h36h.github.io` and allow the included files to merge/replace matching paths.

### Difficulty overhaul
- Story 40 is now a hard endgame breakpoint.
- Every normal mob from Story 40 through Story 60 has **at least 10x health and 10x raw damage** before boss modifiers.
- The multiplier ramps beyond the minimum: approximately 10x at 40, 14x at 45, 20x at 50, 28x at 55, and 40x at 60.
- Story 40+ enemies gain armor penetration so high Defense cannot reduce late-game attacks to trivial chip damage.
- Bosses receive stronger HP/damage modifiers and additional armor penetration on top of the stage multiplier.
- Boss helper counts increase in the late game.

### New stories
- SpaceStories now contains **60 story stages across 12 zones**.
- Stories 51–55: **Supercluster Carnival** — Carousel Comets / Ringmaster Quasar.
- Stories 56–60: **Last Light Cradle** — Starling Wisps / The Bedtime Supernova.

### Gear safety retained
- Rarity power bands remain strictly non-overlapping: **Common < Uncommon < Rare < Epic < Cosmic**.
- Existing saved items are normalized into their rarity band on load.
- Gear progression reaches its intended late-game band by Story 50, so extending to Story 60 does not silently downgrade existing Story-50 gear.
- Cargo items keep both **EQUIP** and guarded **DELETE** actions.

### Other systems retained
- Single centered modular command viewport.
- Live Firebase world chat.
- Auto Pilot and manual combat.
- Star Map, Shop, Gear, Cargo, Log, Stats, Chat, and Help overlay modules.
- Per-E.R.A.S.-profile browser save data.

## Controls
- A / D or Left / Right — move
- Space / W / Up — jump
- J — Pulse Pop
- 1 — Nova Bubble
- 2 — Comet Dash
- 3 — Patch Pod
- E — toggle Auto Pilot
