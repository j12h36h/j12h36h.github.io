# DAI Engine 4.0 public network contract

Canonical endpoint: `/dai/api/packs-4.0.json`

This endpoint is consumed by the DAI Engine ERAS/public pack browser and by the website. It uses the Engine schema-3 transport shape:

- root `packs[]`
- `public_type: "experience_pack"` or `"addon"`
- stable `id` independent of version
- `version` is display/update metadata, not identity
- `components[].download_url` is the direct install URL
- `components[].source_page` may be used by website/Creator UI
- Experience Packs may control addon composition in their own experience metadata; addon whitelists target addon IDs, never versions.

`packs.json` and `packs.pending.json` are legacy DAI 3.x/staging endpoints and must not be used as the DAI 4 public network source.
