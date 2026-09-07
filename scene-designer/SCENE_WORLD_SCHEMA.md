# E.R.A.S. 3D Format v1

The 3D creation hierarchy is:

`Object -> Structure -> Scene -> World`

Supporting reusable assets are `Material` and `Ruleset`.

## Object
A reusable model/primitive. Objects define their native dimensions, default material, collision behavior, and UV scale. Scene placements reference an Object by `assetId` and store only placement/customization data.

## Structure
A reusable assembly of Objects, such as a doorway, building module, room, bridge, or prop group. Structures may expose sockets.

## Material
A reusable surface definition. The v1 browser renderer supports base color, roughness, metalness, a texture URL, and repeat/tiling. Scene placement can override UV tiling without stretching the source texture.

## Scene
A bounded 3D map chunk. A Scene contains Object/Structure placements, markers, lights, and connection sockets. `chunkSize` is the Scene's nominal world-space footprint.

Common marker types:
- `team_spawn`
- `objective`
- `item_spawn`
- `spectator`

Common collision values:
- `solid`
- `none`
- `trigger`
- `ladder`
- `invisible-barrier`

## Socket
A named connection point on a Scene or Structure. Sockets use a `kind`, position, and direction. Compatible sockets can be snapped together by a World editor or procedural generator.

Examples: `road`, `door`, `tunnel`, `rail`, `river`.

## World
A top-level composition of reusable Scene chunks. Worlds should reference Scene IDs rather than copying each Scene's geometry. The runtime can stream nearby Scene chunks and unload distant chunks.

```json
{
  "eras3d": 1,
  "type": "world",
  "sceneChunks": [
    {"id":"chunk-0-0","sceneId":"scene.tactical_arena_01","position":[0,0,0]},
    {"id":"chunk-1-0","sceneId":"scene.tactical_arena_02","position":[64,0,0]}
  ]
}
```

## Animation integration
Scene Objects may later reference Animation Designer assets by adding an `animations` map or animation asset IDs. This keeps animation data independent from geometry while allowing doors, lifts, platforms, machinery, environmental effects, and other Scene objects to use the same E.R.A.S. JSON animation language.
