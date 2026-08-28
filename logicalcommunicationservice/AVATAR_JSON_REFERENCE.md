# LCS v0.7.2 Character Avatar JSON

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
- `layers`: 1–96 character layers
- `char`: 1–4 visible Unicode grapheme characters from any language supported by the user's built-in browser/system fonts
- `x`, `y`: -64 through 192
- `fontSize`: 4 through 192
- `fontFamily`: Arial, Verdana, Georgia, Courier New, Trebuchet MS, Times New Roman, system-ui, monospace, sans-serif, serif
- `fontWeight`: 400, 700, or 900
- `rotation`: -360 through 360
- `opacity`: 0 through 1
- `align`: start, middle, or end

The JSON is public profile data. It cannot load image URLs, fonts, scripts, raw SVG, HTML, or CSS. The site validates it and creates its own SVG text elements.


## Performance

LCS caches validated rendered SVG output in the browser so repeated appearances of a complex avatar do not rebuild all 96 character layers every time it appears in the feed.

The canonical saved JSON is capped at 32,000 characters.


## Multilingual glyphs

v0.7.2 explicitly supports Unicode glyphs from non-English writing systems. Examples include `Ж`, `Ω`, `あ`, `界`, `한`, `ش`, `א`, `क`, `ก`, `ᚠ`, and other characters already renderable by the visitor's built-in browser/system fonts.

LCS does not download or accept custom font files. If the selected font does not contain a requested glyph, the browser may use an installed fallback font. `system-ui`, `sans-serif`, and `serif` are recommended for broad language coverage.

Character limits are counted as Unicode grapheme clusters where the browser supports `Intl.Segmenter`, so accented letters and composed writing-system characters are handled as visible characters rather than raw UTF-16 code units. Control characters and bidirectional override/isolate controls remain rejected.
