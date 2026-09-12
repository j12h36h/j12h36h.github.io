# E.R.A.S. DRAW Supplies

Public `Supplies` assets are local-install packages for the DRAW canvas.

A Supplies catalog entry uses:

```json
{
  "type": "supplies",
  "category": "supplies",
  "supplyData": {
    "items": [
      {"id":"brush_id","name":"Brush Name","kind":"brush","source":"/public-assets/...png"},
      {"id":"sprite_id","name":"Sprite Name","kind":"sprite","source":"/public-assets/...png"},
      {"id":"image_id","name":"Image Name","kind":"image","source":"/public-assets/...png"}
    ]
  }
}
```

Installing a Supplies pack stores its items only in the browser's local
IndexedDB database. It does not create a Firestore Collection holding.
