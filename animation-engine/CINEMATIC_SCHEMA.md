# Simple Animation Designer — Cinematic Schema v3

S.A.D. v1.3.0 keeps the v1.2 cinematic/3D renderer and adds the first full cartoon/anime authoring pass. Existing v1/v2 projects remain valid.

### v1.3 cartoon/anime upgrades

- recursive 2D `group` / `bone` hierarchy with cycle protection
- real keyframed 2D camera: pan, zoom, rotation, shake, spline smoothing
- `polygon` and point-based `path` vector objects plus optional SVG `d` paths
- point-array interpolation for shape morphing
- object masks / clipping with `mask` or `clipPath`
- gradient fills, skew/shear, pivots
- reusable animation `clips` for rig poses/cycles
- deterministic JSON particle `emitter` objects
- parentable 2D point lights

## 2D Camera

```json
"camera": {
  "x": 480, "y": 270, "zoom": 1, "rotation": 0, "shake": 0,
  "interpolation": "spline", "smoothing": 1,
  "keyframes": [
    {"t":0,"x":430,"y":260,"zoom":0.9},
    {"t":3,"x":520,"y":245,"zoom":1.2,"rotation":2,"easing":"ease-in-out"}
  ]
}
```

The 2D camera is centered on `x/y`. `zoom` is clamped to a safe positive range. Camera motion uses the same spline/linear/step track controls as the 3D camera.

## Cartoon Rig Hierarchy / Bones

`bone` is an invisible transform node, equivalent to a group but clearer for articulated rigs. Parent chains may be nested to arbitrary practical depth.

```json
{"id":"shoulder","type":"bone","x":400,"y":250,"rotation":-20},
{"id":"upper-arm","parent":"shoulder","type":"rect","x":0,"y":50,"width":24,"height":100,"anchorY":0},
{"id":"elbow","parent":"shoulder","type":"bone","x":0,"y":100,"rotation":25},
{"id":"forearm","parent":"elbow","type":"rect","x":0,"y":42,"width":20,"height":84,"anchorY":0}
```

`pivotX` / `pivotY`, `skewX` / `skewY`, scale, rotation, opacity and timing are inherited through the hierarchy. Cyclic parent references are hidden instead of recursing forever.

## Vector Paths + Morphing

```json
{
  "id":"face", "type":"path", "x":400, "y":240, "closed":true, "smooth":true,
  "points":[[-50,-40],[40,-55],[60,10],[20,60],[-55,35]],
  "fill":"#f0c78e",
  "keyframes":[
    {"t":0,"points":[[-50,-40],[40,-55],[60,10],[20,60],[-55,35]]},
    {"t":1,"points":[[-60,-20],[30,-65],[70,0],[30,70],[-60,25]]}
  ]
}
```

`polygon` and `path` accept `points` as `[x,y]` pairs or `{x,y}` objects. Matching point arrays interpolate numerically between keyframes. A `path` may alternatively use an SVG-compatible `d` string through the browser `Path2D` implementation; `d` strings switch discretely rather than morphing.

## Masks / Comic Panels

Set `mask` or `clipPath` to another 2D object's id. Set `maskOnly:true` on a shape used only as a mask.

```json
{"id":"panel-mask","type":"path","maskOnly":true,"points":[[-200,-150],[220,-130],[180,160],[-230,180]]},
{"id":"art","type":"sprite","mask":"panel-mask","asset":"hero","x":480,"y":270}
```

## Gradients + Skew

`fill` and `stroke` may be strings or gradient objects.

```json
"fill": {
  "type":"linear", "x0":-100, "y0":0, "x1":100, "y1":0,
  "stops":[{"offset":0,"color":"#43210d"},{"offset":1,"color":"#f0c864"}]
}
```

2D objects may animate `skewX` and `skewY` in degrees.

## Reusable Animation Clips

```json
"clips": {
  "wave": {
    "duration":1.2, "loop":true,
    "keyframes":[{"t":0,"rotation":-25},{"t":0.6,"rotation":25},{"t":1.2,"rotation":-25}]
  }
}
```

Apply with `"clip":"wave"`, plus optional `clipStart`, `clipRate`, and `clipLoop`. The clip overrides the properties it animates while normal object keyframes can animate other properties.

## Particle Emitters

```json
{
  "id":"sparks", "type":"emitter", "x":500, "y":250,
  "emitRate":30, "burst":4, "life":0.8, "speed":130, "speedJitter":0.35,
  "direction":-90, "spread":80, "gravityY":120,
  "size":10, "sizeEnd":1, "color":"#fff4b0", "colorEnd":"#d77919",
  "particleShape":"circle", "maxParticles":300
}
```

Emitters are deterministic from project time, so scrubbing the timeline recreates the same particles instead of depending on hidden runtime state. Supported particle shapes: `circle`, `rect`, and `line`.

---

## Camera

3D projects can animate the camera with the same `keyframes` format used by objects.

```json
"camera": {
  "x": 0,
  "y": 1,
  "z": -10,
  "rotateX": -4,
  "rotateY": 0,
  "rotateZ": 0,
  "fov": 520,
  "shake": 0,
  "near": 0.2,
  "far": 5000,
  "interpolation": "spline",
  "smoothing": 1,
  "keyframes": [
    {"t": 0, "x": -2, "fov": 480},
    {"t": 4, "x": 1, "fov": 560, "easing": "ease-in-out"}
  ]
}
```

Instead of explicit rotation, a camera may use `targetX`, `targetY`, and `targetZ`. Those properties can also be keyframed.

Camera position and look-at tracks use spline interpolation by default in v1.2. Set `"interpolation":"linear"` on the camera or an individual keyframe for a straight segment, or `"interpolation":"step"` for a hard cut. `smoothing` ranges from 0 to 1. `near` and `far` control the 3D clipping planes.

## Groups / Parent Transforms

Use an invisible `group` object and reference it with `parent`.

```json
{"id":"ship-rig","type":"group","x":0,"y":0,"z":0,
 "keyframes":[{"t":0,"x":-4},{"t":5,"x":3}]},
{"id":"ship","parent":"ship-rig","type":"box","x":0,"y":0,"z":7,"width":3,"height":1,"depth":5}
```

Children inherit position, rotation, scale, opacity, visibility, and active start/end time from their parent chain.

## Lighting

```json
"lighting": {
  "ambient": {"color":"#7890ad","intensity":0.25},
  "directional": [
    {"id":"sun","x":-0.5,"y":0.8,"z":-0.5,"color":"#fff1d2","intensity":1.1}
  ],
  "point": [
    {"id":"lamp","x":2,"y":1,"z":5,"color":"#65cfff","intensity":2.5,"range":7,"falloff":2,"decay":1,
     "keyframes":[{"t":0,"intensity":0.5},{"t":3,"intensity":3}]}
  ],
  "shadows": {"enabled":true,"groundY":-2.5,"opacity":0.25,"softness":16}
}
```

Supported 3D lighting: ambient, directional, spatial point lighting, colored light, emissive surfaces, and optional projected ground shadows.

Point lights are evaluated from their real 3D position against each rendered surface. `range` limits influence, `falloff` controls edge softness, and `decay` controls distance attenuation. A point light may specify `parent` / `parentId` to follow a moving object or group.

Objects can use:

```json
"emissive": "#54d8ff",
"emissiveIntensity": 0.6,
"castShadow": true
```

## Sound

Audio files are assets:

```json
"assets": {
  "music": {"type":"audio","src":"./music.ogg"},
  "boom": {"type":"tone","wave":"sine","frequency":72,"duration":0.8}
}
```

Place them on the timeline with `sounds`:

```json
"sounds": [
  {"id":"music-track","asset":"music","start":0,"end":18,"volume":0.7,"pan":0,"rate":1},
  {"id":"impact","asset":"boom","start":8.5,"volume":0.2,"pan":0.35,
   "keyframes":[{"t":8.5,"volume":0.2},{"t":9.1,"volume":0.02}]}
]
```

Sound properties that can be keyframed: `volume`, `pan`, `rate`, and `frequency` for procedural tones. Imported audio is kept local when added through ADD AUDIO; exported JSON stores the media path rather than embedding binary audio.

## Cinematic Post Effects

```json
"post": {
  "exposure": 1,
  "vignette": 0.25,
  "letterbox": 0.06,
  "fade": 0,
  "flash": 0,
  "grain": 0.03,
  "tint": "#6f87c9",
  "tintOpacity": 0.05,
  "keyframes": [
    {"t":0,"fade":1},
    {"t":1,"fade":0,"easing":"ease-out"},
    {"t":5,"flash":1,"easing":"step"},
    {"t":5.4,"flash":0,"easing":"ease-out"}
  ]
}
```

## Object Timing

Objects may use `start`, `end`, and `visible` in addition to normal keyframes.

## Easing

Supported easing values remain:

- `linear`
- `step`
- `ease-in`
- `ease-out`
- `ease-in-out`
