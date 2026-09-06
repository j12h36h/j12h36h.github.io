# Simple Animation Designer — Cinematic Schema v2

S.A.D. v1.1.0 keeps the existing JSON-first format and adds cinematic systems. Existing v1 projects remain valid.

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
  "keyframes": [
    {"t": 0, "x": -2, "fov": 480},
    {"t": 4, "x": 1, "fov": 560, "easing": "ease-in-out"}
  ]
}
```

Instead of explicit rotation, a camera may use `targetX`, `targetY`, and `targetZ`. Those properties can also be keyframed.

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
    {"id":"lamp","x":2,"y":1,"z":5,"color":"#65cfff","intensity":2.5,"range":7,
     "keyframes":[{"t":0,"intensity":0.5},{"t":3,"intensity":3}]}
  ],
  "shadows": {"enabled":true,"groundY":-2.5,"opacity":0.25,"softness":16}
}
```

Supported 3D lighting: ambient, directional, point, colored light, emissive surfaces, and optional projected ground shadows.

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
