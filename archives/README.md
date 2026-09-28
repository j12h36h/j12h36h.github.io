# E.R.A.S. Archives

`/archives/` is a public reading room backed by the `founderArchives` Firestore collection.
Visitors can browse published entries and use the speech voices already installed in their browser or operating system. Audio is generated locally by the browser's Speech Synthesis API.

## Publishing

1. Deploy the included `logicalcommunicationservice/firestore.rules` update before using live publishing. It makes archive reads public and limits create/update/delete access to the configured E.R.A.S. Founder verified through the existing `systemAuthority/founderProbe` rule.
2. Sign in to an E.R.A.S. account through the Social area.
3. Open the Founder Desk in Archives. Use **Dokkōdō** for the first text or **Five Rings Chapter** to prepare the next unfilled chapter. These buttons create editor drafts only; nothing is published until a valid entry is saved.
4. Add text, use **Preview**, and publish. Entries appear in the collection for all visitors.

The Book of Five Rings series scaffold is in `data/book-of-five-rings.json`. Chapter headings are supplied as empty templates; the Founder adds the chosen text chapter by chapter.

## Entry JSON

Use `data/entry-template.json` as a schema example. Each Firestore entry has `schemaVersion`, `id`, `title`, `author`, `category`, `summary`, `order`, `status`, `visual`, `content`, and `updatedAt`. Optional `series` and `chapter` fields group multi-part works.

Supported content block types are `title`, `paragraph`, `quote`, `character`, `image`, `divider`, and `pagebreak`. Paragraphs accept `align` and an optional `character` object. Character blocks accept `placement` values `float-left`, `float-right`, or `inline`. The `visual` object controls `pageBackgroundColor`, `pageTextColor`, `accentColor`, `fontFamily`, `icon`, `animation`, and page-edge `characters`.

Images use HTTPS URLs or same-site absolute paths. They are loaded as images and never executed as markup. The reader accepts only a small set of color formats, font family text, and named entrance/icon animations.
