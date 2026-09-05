# Vendored from the Dataside Design System — do not hand-edit

`colors_and_type.css` is a **verbatim copy** of `colors_and_type.css` in the design-system project
`1795979c-8cd4-4e79-80b5-99201daee465` (*Dataside Design System*), read on **2026-09-04** through
the `DesignSync` MCP. When the design changes, re-import the file; never edit this copy
(constitution §4, and `docs/design-system.md`).

It lives in `public/` rather than `src/` precisely so it stays verbatim: Vite copies `public/`
byte-for-byte instead of rewriting its `url()` references, so the file needs no local adjustment to
build. `index.html` links it directly.

## Fonts

`fonts/` ships the three **latin** Poppins cuts this UI actually uses — 300 Light, 400 Regular,
600 SemiBold — under the exact filenames the vendored CSS references. They are the Poppins v24
latin subsets from `fonts.gstatic.com`, fetched on 2026-09-04 via the Google Fonts CSS API; the
design system ships the same three cuts under the same names.

The vendored CSS also declares three *italic* faces sourced only from `.ttf`. Those files are not
shipped: this UI renders no italic text of its own, and a `.ttf` cut is roughly twenty times the
weight of the subset `.woff2`. Markdown emphasis synthesises an oblique instead. If real italics
are ever needed, import `Poppins-*Italic.ttf` from the design system rather than substituting a
different font.
