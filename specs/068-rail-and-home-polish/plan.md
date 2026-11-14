# Plan: A home screen that holds together, and a rail that reads at both widths

## Approach

Most of the change is in the stylesheet, edited **in place** so no base rule ever lands after the
breakpoint that overrides it (`layout.test.ts`). The component changes add attributes, one heading
and one icon.

**The centred home block (AC1, AC2)** uses grid only. The DOM does not move. Inside
`@media (min-width: 761px) and (min-height: 640px)`:

```css
.main:has(> .conversation--empty) {
  grid-template-rows: auto minmax(0, 1fr) minmax(0, auto) auto auto minmax(0, 1fr);
}
.main:has(> .conversation--empty) > .conversation--empty { grid-row: 3; }
.main:has(> .conversation--empty) > .composer { grid-row: 4; }
.main:has(> .conversation--empty) > .error-card { grid-row: 5; }
```

- **Why the block's row has priority.** Its row is `minmax(0, auto)` and the two spacers are
  `minmax(0, 1fr)`. The grid algorithm grows intrinsic tracks up to their content ("maximize
  tracks") before it hands leftover space to flexible ones. So the block gets the height it needs
  first, and the spacers share what remains equally, which centres the block plus the composer.
  On a short window the spacers fall to 0 and the block's own `overflow-y: auto` scrolls. An
  earlier `auto 1fr auto 1fr` shape split the free height in half and scrolled the greeting on a
  900px-tall window. It was rejected for that.
- **Why the selector uses `>`.** `PlaygroundAgent` renders `Conversation` inside its own columns,
  so a descendant selector would centre those as well (AC2).
- **Why it is a positive media query.** It is not a base rule overridden at 760px. A phone or a
  short window never matches it, so the 760px block needs no undo, and the "base before
  breakpoint" guard has nothing to object to.
- **The block itself.** `.conversation--empty` becomes a flex column, and `.empty` takes
  `margin-block: auto`. A notice still sits on top, and an overflowing block scrolls from its
  start. `align-items: center` with overflow makes the start unreachable.

**The width (AC3)** is the one `--chat-width` property on `.main`. `.empty`'s literal 720px becomes
`var(--chat-width)`.

**The collapsed rail (AC4–AC7)**:

- Attributes: `aria-label` and `title` on New session, the answering agent and each favourite. The
  footer rows get icons and the same attributes.
- CSS:
  - stop hiding the whole `.sidebar__foot`;
  - hide `.history__search`, `.sidebar__lang` and the footer labels instead;
  - stack the brand;
  - give New session and the navigation items fixed sizes;
  - add a top border on the agents section;
  - hide `.favourites li:has(> [aria-current='true'])`.

**The expanded rail (AC8, AC9)**:

- A `sidebar__section-title` paragraph above the search, under the condition that already shows
  the search.
- `.history__search` loses its horizontal margin, so the pill spans the row's width.
- `.history__actions` is positioned absolutely over the row's end (AC11), so the title gets the
  full width. `pointer-events: none` while hidden, so an invisible *delete* can't take a click.
  `opacity` rather than `visibility`, so both actions stay in the tab order.
- `.sidebar__footer` becomes a column of rows in sans type.
- `.sidebar__lang` becomes one bordered track with borderless options.
- The footer is reordered so the two navigation rows come first and the language and theme line
  sits at the bottom.

## Affected files

- `frontend/src/styles/app.css` — `.main` width and the empty-state media block; `.empty`,
  `.conversation--empty`; collapsed rail rules; `.history__search`; footer, `.sidebar__about`,
  `.sidebar__lang`, `.sidebar__lang-option`.
- `frontend/src/panes/Sidebar.tsx` — attributes, the *Conversations* heading, footer row icons and
  order.
- `frontend/src/panes/Favourites.tsx` — `aria-label` and `title` on each row.
- `frontend/src/components/Icon.tsx` — `SlidersIcon` (two sliders) for *Preferences*.
- `frontend/src/styles/chatPresentation.test.ts`, `corporateChat.test.ts` — the 760px pin becomes
  800px (superseded, named in AC3).
- `frontend/src/styles/railAndHome.test.ts` (new) — the declarations behind AC1–AC3 and AC5–AC9.
- `frontend/src/panes/Sidebar.test.tsx`, `Favourites.test.tsx` — AC4, AC8, AC9 structure.
- `specs/README.md`, `CHANGELOG.md`.

## Contract / data model changes (constitution §4)

None.

## i18n strings (constitution §7)

n/a. `history.conversations` (`Conversations` / `Conversas`) exists and was unused. Every other
label reuses an existing key.

## Test strategy (constitution §2 — TDD)

jsdom lays nothing out, so declarations are asserted the way `chatPresentation.test.ts` already
does. What is painted is checked in a browser against the demo (AC10).

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 | media block rows, the block's row and the composer's row, `margin-block: auto` | `railAndHome.test.ts` |
| AC2 | selector is `> .conversation--empty`, inside `min-width: 761px` and `min-height: 640px` only | `railAndHome.test.ts` |
| AC3 | `--chat-width: 800px`; `.empty`, `.composer` and `.conversation__inner` use it | `chatPresentation.test.ts`, `corporateChat.test.ts`, `railAndHome.test.ts` |
| AC4 | collapsed: the six controls carry `aria-label` and `title` | `Sidebar.test.tsx`, `Favourites.test.tsx` |
| AC5 | collapsed rules hide `.history__search` and `.history`, stack `.sidebar__brand`, circle `.sidebar__new` | `railAndHome.test.ts` |
| AC6 | collapsed hides `.sidebar__lang`, not `.sidebar__foot` | `railAndHome.test.ts` |
| AC7 | collapsed agents section has a top border; the current favourite's item is hidden | `railAndHome.test.ts` |
| AC8 | heading present with conversations, absent without | `Sidebar.test.tsx` |
| AC9 | footer rows render an icon; language group outside the scroll (existing); footer sans type | `Sidebar.test.tsx`, `railAndHome.test.ts` |
| AC11 | `.history__actions` absolute, `pointer-events: none` until hover/focus | `railAndHome.test.ts` |
| AC12 | `> .error-card` placed in its own `auto` track (row 5) | `railAndHome.test.ts` |
| AC10 | existing suites (`layout`, `contrast`, `a11y`, `touch`, `vendored`) and a browser check | — |

## Risks / trade-offs

- **`:has()`** is already used for `.app` (spec 021), so this adds no new browser requirement.
- **The block-first track sizing** follows the grid spec's "maximize tracks" step. It was measured
  at 1440×900, at 1440×700 and at 900×660 (see the spec's *Evidence*).
- **Hiding the duplicate favourite** while collapsed drops a second copy of one button from the
  accessibility tree. The answering mark above it names the same agent.
