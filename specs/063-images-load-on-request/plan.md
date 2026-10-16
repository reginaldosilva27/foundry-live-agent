# Plan: 063-images-load-on-request

## Approach

`AnswerImage` gains a `loaded` state, initially false. Unloaded, it renders a placeholder
(`.answer-image__pending`) with the host from `new URL(src).host`, the description, and a button
whose accessible name is `image.load`. A `src` that does not parse renders the description and URL
as text, with no button. Loaded, it renders exactly what spec 044 rendered.

## Affected files

frontend/src/components/AnswerImage.tsx · AnswerImage.test.tsx · i18n/strings.ts ·
styles/app.css · specs/044-images-in-answers/spec.md (superseded-in-part note) · specs/README.md

## Test strategy

| AC | Test (`AnswerImage.test.tsx`) |
|---|---|
| AC1 | no `img` before the click |
| AC2 | host text in the placeholder |
| AC3 | description / no-description text |
| AC4 | button by role + name, `en` and `pt` |
| AC5 | after click: `src`, `loading`, `referrerpolicy`; overlay opens |
| AC6 | unparseable URL: no button, no img |
| AC7 | error after load shows the URL |
