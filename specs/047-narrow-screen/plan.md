# Plan: The app on a narrow screen

> The HOW. Written after `spec.md` is `clarified`.

## Approach

**Reuse the rail; do not build a second navigation.** Below 760px the `Sidebar` stops being a grid
column and becomes an overlay over the conversation, opened by a control in the header and closed by
a backdrop, by Escape, and by choosing anything inside it. It is the *same component, the same
props, the same handlers* — so AC3 holds because there is nothing else it could call, not because a
reviewer checked. It is also the pattern `.trace` already uses at 1100px, which is why this costs a
CSS block and a boolean rather than a feature.

**The header is a budget problem with a computed answer.** At 320px it has 280px of usable width and
wants 614. Spec 004's order — name truncates, branding gives way, controls never shrink — got the
app to 760. One step down the same order runs out, so two things change *at this breakpoint only*:
the two pill buttons render as icons, keeping their names through `aria-label`, and the harness badge
moves into the rail overlay's footer beside the model and the gateway line.

**Nothing is deleted, which is the whole point.** The current behaviour hides the rail with
`display: none`, which takes it out of the accessibility tree too — a screen-reader user at a narrow
width loses navigation rather than finding it collapsed. Every control this plan moves stays
reachable and stays named.

**Alternative rejected: a bottom tab bar.** Comfortable for a thumb, and a second navigation
component to translate, test and keep in step with the rail — and it has no room for the five things
the rail carries beyond the four screens (search, favourites, history, language, new session).

**Alternative rejected: route everything through the palette.** Cheaper still, and wrong: a palette
is a surface for people who know what they are looking for. Someone who has never seen the app does
not discover `/compare` by typing.

## Affected files

- `frontend/src/styles/app.css` — the narrow block: the rail as an overlay with its backdrop, the
  header's budget, the icon-only controls.
- `frontend/src/App.tsx` — a boolean for the overlay being open, passed to the rail; closing it when
  anything inside it navigates.
- `frontend/src/panes/Sidebar.tsx` — accepts "I am an overlay" and renders the harness badge in its
  footer; the nav items already call what they need to.
- `frontend/src/panes/Header.tsx` — the menu control, and the two buttons rendering icon-only at
  this width.
- `frontend/src/i18n/strings.ts` — the menu control's label, in `en` + `pt`.
- `frontend/src/a11y.test.tsx` — the walk parameterised over widths.
- `frontend/src/styles/layout.test.ts` — the narrow block's rules.
- `docs/design-system.md` — the breakpoints and what each does, which is written nowhere today.

## Contract / data model changes (constitution §4)

| | |
|---|---|
| **`AgentEvent` (§9)** | Unchanged. |
| **Routes** | Unchanged. No address, no screen, no entry in `route.ts`. |
| **Navigation handlers** | Still the rail's. The overlay renders the same `Sidebar` with the same props, so there is no second implementation to drift. |
| **The harness badge** | Rendered in two places at different widths, one source: the same `HarnessBadge` component, fed from the same `selectedRow?.harness ?? config?.harness`. A second reading of which harness is driving would be the §4 violation. |
| **i18n (§7)** | One new string: the menu control's accessible name. |
| **Docs** | `docs/design-system.md` gains the breakpoint table. |

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `nav.openMenu` | Open the menu | Abrir o menu |
| `nav.closeMenu` | Close the menu | Fechar o menu |

## Test strategy (constitution §2 — TDD)

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 | at 320 and 390, a control exists for every screen in the route table | `App.narrow.test.tsx` (new) |
| AC2 | the narrow CSS block declares what stops the overflow; the geometry itself is the browser sweep (AC8) | `layout.test.ts` |
| AC3 | choosing a screen from the overlay calls the same handler the rail calls — asserted by rendering the one `Sidebar` and driving it | `App.narrow.test.tsx` |
| AC4 | no interactive control is `display: none` in the narrow block | `layout.test.ts` |
| AC5 | the a11y walk runs at 320 as well as the default, every control named | `a11y.test.tsx` |
| AC6 | the existing suites, untouched | all of them |
| AC7 | both languages | `strings.test.ts` (existing, automatic) |
| AC8 | browser sweep at 320 · 390 · 760, both themes, recorded with its date | not a test — recorded in `spec.md` |

**AC2's honest limit**, and it is the same one `layout.test.ts` already names at the top: jsdom
applies no stylesheet, so the test reads the rules and the browser measures the result. The rules
being declared is what CI can prove; that they produce a 320px-wide page is what the sweep shows.

## Risks / trade-offs

- **The overlay rail is the whole rail**, including the history list and the search field. On a
  320px screen that is a tall panel. It scrolls — spec 021 already made its middle section the only
  thing that does — but it is denser than a purpose-built menu would be. That is the cost of not
  having two navigations.
- **Icon-only controls lose their labels visually.** Their accessible names survive, and a tooltip
  does not exist on touch. Voice and Traces are recognisable icons, but this is the one place the
  narrow layout is genuinely worse rather than merely smaller.
- **The harness badge moves**, so a reader who knows where it lives on a laptop has to look
  elsewhere on a phone. Spec 004 AC9 is satisfied either way; discoverability is slightly worse.
