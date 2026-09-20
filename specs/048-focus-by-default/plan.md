# Plan: A focus ring by default, not by remembering

> The HOW. Written after `spec.md` is `clarified`.

## Approach

**Three rules replace two lists.**

```
*:focus-visible                      → the ring: 2px, offset 2px, --fg-focus
.sidebar *, .trace *                 → --fg-focus becomes the lighter step on ink
.log-scrim, .voice-scrim, .main      → no ring, each with its reason
```

The colour moves into a **custom property** rather than a second selector list. The default rule
draws `var(--fg-focus)`; the deep surfaces redeclare `--fg-focus` on themselves, and every
descendant inherits it. That is what turns sixteen named selectors into one statement per surface,
and it is the same move spec 046 made with `--fg-harness`: name the *job*, let the cascade do the
matching.

**AC1 is the interesting one, because "assert it without a list" is the whole point.** A test that
enumerates selectors would be the allowlist again, in a test file. Instead the assertion is about
the **stylesheet's shape**: a universal `:focus-visible` rule exists and draws an outline, and the
only rules that remove one are the named exceptions. A control added later is covered by the first
and absent from the second, so it cannot ship unindicated — and a future author who adds a fourth
`outline: none` has to add it to the exception list, where the test will see it.

**Alternative rejected: add the 34 missing selectors to the list.** Smallest diff, no risk, and it
leaves the mechanism that produced the 34 exactly as it is.

## Affected files

- `frontend/src/styles/app.css` — the two lists collapse; `--fg-focus` declared per theme and
  redeclared on the deep surfaces; the exception list gains `.main` and its reason.
- `frontend/src/styles/contrast.test.ts` — the ring against its surfaces, both themes (AC5).
- `frontend/src/styles/layout.test.ts` — the stylesheet's shape (AC1, AC2).
- `docs/design-system.md` — the focus rule, written down.

## Contract / data model changes (constitution §4)

| | |
|---|---|
| **`--fg-focus`** | New semantic token, declared in `app.css`'s `:root` beside `--fg-harness` and `--bg-accent-strong`, redeclared on `.sidebar` and `.trace`. One home for "what colour is the ring here". |
| **The focus rule** | `app.css` only. A test asserts no component states its own focus outline. |
| **i18n (§7)** | Nothing. |

## i18n strings

n/a — no new prose.

## Test strategy (constitution §2 — TDD)

| Acceptance criterion | Test |
|---|---|
| AC1 | a universal `:focus-visible` rule exists and sets an outline |
| AC2 | every rule that removes an outline is one of the three named exceptions, and each carries a comment |
| AC3 | `.sidebar` and `.trace` redeclare `--fg-focus`; no per-selector colour list remains |
| AC4 | the 27 selectors that had a ring still match the universal rule — asserted by none of them appearing in the exception list |
| AC5 | the ring token against `--bg-1`, `--bg-2` and the ink surface, both themes, ≥ 3:1 |
| AC6 | the existing suites, untouched |
| AC7 | a browser tab-through, recorded in `spec.md` |

**AC5's honest note**: 3:1 is WCAG 1.4.11's bar for a non-text indicator, not 4.5:1. Using the text
bar here would be inventing a stricter rule than the one being cited, which is the opposite of what
spec 046 spent its time on.

## Risks / trade-offs

- **`*:focus-visible` is a wide net.** Anything focusable gets a ring, including elements given
  `tabindex` for scrolling or for a modal. Three are excepted today; a fourth appearing is a
  deliberate act that the exception test makes visible.
- **The ring may now appear where nobody designed it** — on a container, on a row. That is the
  intended trade: a ring somewhere unexpected is a smaller failure than no ring where it was needed,
  and the browser tab-through is how it gets found.
- **`outline-offset: 2px` on a control flush against a container edge** can clip. Not seen in the
  sweep, named here so it is looked for.
