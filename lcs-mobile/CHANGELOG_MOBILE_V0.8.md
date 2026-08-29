# DAI + LCS Momentum Network v0.8

## LCS
- Added a five-mode Momentum Engine: Create, Solve, Test, Explore, Collaborate.
- Modes prioritize useful actions without hiding or locking the wider network.
- Added action cards for evidence, questions/challenges, building from existing work, and collaboration.
- Added activity-derived momentum stages for ideas, problems, projects, and Idea Map nodes. Momentum is explicitly not a truth/completion score.
- Added a session impact recap that counts state-changing actions rather than time spent, streaks, or passive scrolling.
- Added DAI context suggestions that are dismissible and never auto-post, auto-tag without a click, or create forced relationships.
- Added category-specific progression bars across Idea Map, Ideas, Problems, Projects, Communities, Connections, and LFG.
- Desktop and the separate /lcs-mobile/ interface receive the same Momentum features while preserving their separate authentication implementations.

## DAI Network
- Added the DAI ↔ LCS correlation bridge to every DAI HTML page.
- The bridge derives a suggested DAI context from the page and offers Explore / Test / Create / Collaborate routes into LCS.
- Added explicit LCS correlation links to every System Constellation category on the DAI Universe page.
- Added a dedicated DAI ↔ LCS bridge section to the Universe homepage.
- Mobile-sized DAI pages route to /lcs-mobile/; desktop routes to /logicalcommunicationservice/.

## Firebase
- No Firestore schema, Rules, or index changes are required for Momentum v0.8.
- Existing v0.7.5 rules remain compatible.
- The /lcs-mobile/ build still uses the separate same-origin Firebase auth-helper setup introduced in mobile v0.7.12.
