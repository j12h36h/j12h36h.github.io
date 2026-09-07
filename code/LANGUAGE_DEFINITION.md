# E.R.A.S. CODE — Modular Language Definition v1

A language is a standalone JSON document. Built-in languages and creator-defined
languages use the same structure.

```json
{
  "id": "example",
  "name": "Example Language",
  "extensions": [".ex"],
  "lineComment": "//",
  "blockComment": { "start": "/*", "end": "*/" },
  "stringQuotes": ["\"", "'", "`"],
  "keywords": ["if", "else", "return"],
  "literals": ["true", "false", "null"],
  "builtins": ["print"],
  "operators": ["=", "+", "-", "*", "/"],
  "highlightNumbers": true,
  "caseSensitive": true
}
```

## Design rule

Language definitions are data, not executable JavaScript. The initial highlighter
does not execute arbitrary regular expressions from imported definitions. This
keeps creator language packs portable and substantially safer to load in-browser.

Future CODE versions can extend the schema with grammar states, semantic tokens,
completion providers, formatter modules, linters and project tooling while
preserving this base format.
