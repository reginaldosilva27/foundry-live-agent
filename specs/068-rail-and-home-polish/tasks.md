# Tasks: A home screen that holds together, and a rail that reads at both widths

## Slice A — the home screen

- [x] **T1 — red**: AC1/AC2 — `railAndHome.test.ts` asserts the empty-state media block, the direct-child selector, rows and placement, and `margin-block: auto`.
- [x] **T2 — red**: AC3 — the 760px pins in `chatPresentation.test.ts` and `corporateChat.test.ts` become 800px, and `.empty` uses `var(--chat-width)`.
- [x] **T3 — green**: `app.css` — `.main`, `.conversation--empty`, `.empty`, and the media block.

## Slice B — the collapsed rail

- [x] **T4 — red**: AC4 — `Sidebar.test.tsx` and `Favourites.test.tsx` check that each collapsed control carries `aria-label` and `title`.
- [x] **T5 — green**: `Sidebar.tsx` and `Favourites.tsx` attributes.
- [x] **T6 — red**: AC5/AC6/AC7 — `railAndHome.test.ts` asserts the collapsed declarations.
- [x] **T7 — green**: `app.css` collapsed rules.

## Slice C — the expanded rail

- [x] **T8 — red**: AC8/AC9 — `Sidebar.test.tsx` checks the heading and the footer row icons; `railAndHome.test.ts` checks the footer's type and the language track.
- [x] **T9 — green**: `SlidersIcon`, `Sidebar.tsx` heading and footer, `app.css` footer, search and language.

## Slice D — verify

- [x] **T10 — verify**: AC10 — frontend gates (lint, 1233 tests, build, e2e) and gitleaks. Browser check per the spec's *Evidence*: the demo plus local rendering, 390 and 1440, light and dark, rail open and collapsed, and short windows.
- [x] **T10b — red/green**: AC12 — the voice failure placed under the composer (found in review).
- [x] **T10c — red/green**: bug — the closed narrow rail's off-canvas shadow (found at 390px).
- [x] **T11 — docs**: `specs/README.md` row, `CHANGELOG.md` entry, status `done`.

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean · tests green · build passes
- [x] Docs updated in the same change (§4)
- [x] No new user-facing text (the one heading reuses an existing en/pt key)
- [x] `spec.md` status updated to `done`
