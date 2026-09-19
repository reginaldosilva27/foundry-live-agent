# Plan: Images in an answer

> The HOW, written after `spec.md` reached `clarified` (2026-09-19). The clarify step split the
> spec in two and shipped one half: the rendering. The generation tool is deferred for want of a
> verified API (§10), not for want of a design.

## Approach

One more `react-markdown` override, beside spec 033's `code`/`pre`/`table` and spec 035's: `img`
becomes a component that sizes the image to the column, reserves its space, states when it has no
description, and opens larger on demand.

**No contract change** (§9) — an image arrives as Markdown in `text_delta`, which is the whole
argument for not spending a tenth event type on transporting a URL.

**No new request from the frontend** to produce anything (AC9). The only network effect is the
browser loading an `<img>`, which is the one place the app's "talks to the BFF and nothing else"
rule bends — mitigated with `referrerpolicy="no-referrer"` and `loading="lazy"`, and documented
rather than left to be noticed.

## Affected files

- `frontend/src/components/AnswerImage.tsx` (new) + test.
- `frontend/src/components/Markdown.tsx` — the `img` override.
- `frontend/src/i18n/strings.ts`, `frontend/src/styles/app.css`.
- `docs/architecture.md` — the one origin that is not the BFF.
- `docs/REFERENCES.md` — the generation half, as an open item.

## Test strategy (§2 — TDD)

| AC | Test |
|---|---|
| AC1/AC2 | renders fitted, with space reserved, and never wider than its container |
| AC3 | the alt text is the Markdown's; with none, it says no description is available |
| AC4 | selecting opens an overlay that traps focus and restores it |
| AC5 | the export carries the URL (it already does — the answer is Markdown) |
| AC6 | a load failure renders the URL, visible and copyable |
| AC8 | the contract is untouched — existing tests, unchanged |
| AC9 | rendering issues no `fetch` |
| AC11 | a large `data:` source is refused rather than rendered |
| AC12 | the attributes are present |
