# E.R.A.S. Global Premade Modes Patch — 2026-09-06

This patch publishes Global versions of the five premade game modes that were still absent from the Global selector:

- Galactic Dominion
- Surface Discovery
- Jeng-stroid
- Sunball
- Soldoku

Together with Turn-Based Global, Slime Smash, Escape Pod Dash, and Side Scroller, the site now exposes nine official Global games.

## Shared Global progression

The five new tracks use the same E.R.A.S. milestone curve already used by the Global arcade games:

- 5,000 cumulative best score = +1 Credit
- 10,000 = +2 additional Credits
- 15,000 = +3 additional Credits
- and so on.

Milestones are lifetime best-score milestones per profile and per game. They are not paid repeatedly for replaying the same score.

The browser writes a deterministic best-score record into `gameActions`. The new authenticated Firebase callable reads that exact record before changing `creditWallets`. The client never directly mints Credits.

## Fixed Global scoring

**Surface Discovery**
- +100 per discovery
- +5,000 completion bonus
- 3 lives

**Jeng-stroid**
- +500 per successfully removed block
- score may be banked before collapse
- collapse ends the run

**Sunball**
- +250 per registered bumper hit
- 3 balls

**Soldoku**
- +100 per manually correct entry
- -100 per mistake
- hints award no score
- +5,000 solve bonus

**Galactic Dominion Global**
- 40-turn solo Dominion Trial using the existing Galactic board/economy rules
- E.R.A.S. Credits never replace or convert the game's local Galactic currency
- final Global score = final local net worth × 2
- only the final Global score enters the network milestone system

## Deployment

The website portion is drag-and-drop compatible with the repository root.

The patch also changes the Firebase Functions package entry point from `index.js` to `eras-functions.js`. The wrapper exports every existing function from `index.js` and then adds `claimGlobalPremadeMilestones` from `global-premade-functions.js`.

After the files are in the repository, deploy the Firebase Functions project so the new authenticated reward callable is live. Until that backend deployment happens, gameplay and scoreboards can run, but new-mode Credit milestone claims will report that the callable is unavailable.

No Firestore rules expansion is required: the score records use the already-permitted signed-in `gameActions` path and non-`global` world IDs, matching the pattern used by the existing Global arcade scoreboards.
