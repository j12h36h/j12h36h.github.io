# LCS v0.7 Character Avatar JSON

Click the circular profile image on **Account** to open the live JSON editor.

The renderer accepts this public format:

```json
{
  "version": 1,
  "background": "#34264c",
  "layers": [
    {
      "char": "J",
      "x": 56,
      "y": 64,
      "fontSize": 58,
      "color": "#ffb22e",
      "fontFamily": "Arial",
      "fontWeight": 900,
      "rotation": -8,
      "opacity": 1,
      "align": "middle"
    },
    {
      "char": "/",
      "x": 72,
      "y": 64,
      "fontSize": 78,
      "color": "#925cff",
      "fontFamily": "Courier New",
      "fontWeight": 900,
      "rotation": 18,
      "opacity": 0.9,
      "align": "middle"
    }
  ]
}
```

Limits:

- `version`: exactly `1`
- `background` / `color`: six-digit `#RRGGBB`
- `layers`: 1–24
- `char`: 1–4 visible Unicode characters
- `x`, `y`: -64 through 192
- `fontSize`: 4 through 192
- `fontFamily`: Arial, Verdana, Georgia, Courier New, Trebuchet MS, Times New Roman, monospace, sans-serif, serif
- `fontWeight`: 400, 700, or 900
- `rotation`: -360 through 360
- `opacity`: 0 through 1
- `align`: start, middle, or end

The JSON is public profile data. It cannot load image URLs, fonts, scripts, raw SVG, HTML, or CSS. The site validates it and creates its own SVG text elements.
