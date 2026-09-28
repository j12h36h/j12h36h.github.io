# DAI Engine 4 public network contract

Canonical current endpoint: `/dai/api/packs-4.2.json`

The registry uses schema 4 and preserves the stable pack IDs, component URLs, and experience/addon split introduced in 4.1. DAI Engine 4.2 adds datapack-driven title launcher takeover using `dai_shell_presentations`; its canonical pause screen and scene identifiers are `pause`. The 4.1 Creator/runtime contract remains available at `/dai/api/packs-4.1.json` for clients that have not moved to the final 4.2 release.

Compatibility endpoints remain published: `/dai/api/packs-4.1.json` (DAI 4.1) and `/dai/api/packs-4.0.json` (DAI 4.0). `/dai/api/packs.json` remains legacy DAI 3.x compatibility only.

The web Packs page and Creator read the 4.2 endpoint first. Public pack IDs and direct component URLs remain unchanged.
