# DAI Engine 4.1 public network contract

Canonical current endpoint: `/dai/api/packs-4.1.json`

Compatibility alias: `/dai/api/packs-4.0.json` remains published for Engine 4.0 clients and older 4.x builds.

The registry uses the Engine schema-4 transport shape:

- `sections.experience_packs[]` and `sections.addons[]`
- stable `id` independent of version
- `version` is display/update metadata, not identity
- `components[].download_url` is the direct install URL
- `components[].source_page` may be used by website/Creator UI
- Experience Packs may control addon composition in their own experience metadata; addon whitelists target addon IDs, never versions.

DAI Engine 4.1 also synchronizes supported server datapack presentation definitions to connected clients for the active session. This does not change pack identity or registry semantics.

`packs.json` and `packs.pending.json` remain legacy DAI 3.x/staging endpoints.
