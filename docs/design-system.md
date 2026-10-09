# The design system, and the two palettes

> Spec [036](../specs/036-preferences-and-theme/spec.md). What is vendored, what is ours, and why
> the line is where it is.

## Preferences that affect the screen

[Spec 052](../specs/052-preferences-applied/spec.md) reconciles spec 036's controls. Preferences,
rail language buttons and the command palette use one browser-kept language for strings and
`document.lang`; only an absent choice falls back to browser detection. Reasoning defaults apply
in chat and comparison, while a deliberate card toggle wins for that mounted turn as streaming
updates arrive. Navigating away unmounts the card; reopening uses the current default.

Reading remains parked (spec 008), so there is no checkbox promising it. Activity remains visible
inline, with no expansion checkbox; it is not the Traces drawer. The old `speakAnswers` and
`activityOpen` storage fields are preserved but inert, never authorization to spend speech costs.
No preference changes the agent or travels to Foundry.

## Two files, one rule

`frontend/public/ds/colors_and_type.css` is the Dataside design system, **vendored**: it holds the
ramps, the type scale, the spacing grid and the status colours. `frontend/src/styles/app.css` is
ours and holds the **mapping** — which ramp step is `--bg-1`, what `--fg-3` means in dark.

The rule that keeps them apart: **a colour literal may only appear in the vendored file**, and a
test asserts it (`layout.test.ts`). `app.css` names tokens and never values. Anything else and a
re-import of the design system would quietly revert a decision.

The two additions this repository has made to the vendored file are both colour, so both belong
there: the categorical series palette (spec 033) and the dark syntax colours (spec 036).

## The elevation stack

The rail does **not** invert between themes. It is already the dark surface against a light column,
and in dark it simply becomes the deepest one — so the element a reader navigates by keeps its
character in both themes.

| | light | dark |
|---|---|---|
| rail `--bg-inverse` | `--ds-ink` | `--ds-ink` — deepest, recessed |
| ground `--bg-2` | `--ds-n-50` | `--ds-n-900` |
| card `--bg-1` | `--ds-white` | `--ds-ink-2` — the DS calls this "elevated dark surface" |
| raised `--bg-3` | `--ds-n-100` | `--ds-n-800` |

## How a theme is chosen

Three states: follow the system, light, dark.

- **Light is the base declaration.** Every semantic token is defined in `:root`, so neither theme
  depends on a media query alone — a token defined in one place and not the other is how a screen
  ends up rendering one theme's text on the other theme's ground.
- **`[data-theme='dark']`** is an explicit choice, written by the preferences store.
- **`@media (prefers-color-scheme: dark)`** is "follow the system", guarded by
  `:not([data-theme='light'])` so an explicit light choice survives a dark system.
- **`system` removes the attribute** rather than writing one, which is what lets the media query
  track a change made while the app is open with no listener of our own.

**The first paint** is handled by a six-line inline script in `index.html`, before the bundle
loads. CSS cannot read storage, so there is no CSS-only answer; without it the app paints the other
palette and corrects itself on every load. That script spells the storage key itself, because it
runs before any module exists — the one deliberate duplication here, and `preferences.test.ts`
asserts the two spellings agree.

## Syntax highlighting

The light theme is `highlight.js/styles/github.css`, imported as given. The dark theme is a mapping
of the **same groups that file defines**, read out of it rather than guessed, because an `@import`
cannot be scoped to an attribute — importing a second theme file would overwrite the first for both
themes.

Every class github.css colours has a dark counterpart, including the unclassified ones
(`.hljs-params`, `.hljs-subst`, `.hljs-punctuation`). Missing one is not a subtle bug: it renders
navy on navy and the text disappears.

## Charts

The categorical series palette is **selected per theme, never flipped**. Both sets are validated
all-pairs — every series in a chart is on screen at once, so adjacent-only would be the wrong test.

```
light  #0074FF  #B45309  #00998C  #A21CAF
dark   #0074FF  #B45309  #00998C  #BE2FCF
```

Only the fourth slot differs: `#A21CAF` falls to 2.52:1 contrast against the dark card surface, so
it is re-stepped. There is no fifth hue in either set — eight candidates were tried and each
collided with one of the four, which is why `state/chart.ts` caps a chart at four series.

## What this browser keeps

Every storage key lives in `state/storage.ts`'s `KEYS` registry, and a test asserts no module
outside it touches `localStorage` or spells a key. The point of "what this browser keeps" is that
it can be listed, exported and cleared — which stops being true the moment a key exists that
nothing can enumerate.

## Focus, live regions and contrast (spec 040)

**The skip link is the first focusable element** on every load, because the rail is otherwise the
first thing between the keyboard and the composer. It is moved off-screen with a transform rather
than `display: none` — a hidden element is not focusable, and then the link does nothing for the
one person it exists for.

**One polite live region** holds one sentence, and it says the answer is ready. The streaming
answer itself is deliberately **not** in a live region: announcing it token by token would read the
whole thing into the queue as it arrives, which is worse than silence. The turn's shape — three
tools, twelve seconds — is already on screen and stays there.

`aria-live="polite"` without `role="status"`: the role only implies the same politeness, and a
second element carrying it makes `getByRole('status')` ambiguous for every other surface that
reports a copy confirmation.

**Contrast is computed, not asserted in prose.** `contrast.test.ts` resolves the semantic
text-on-surface pairs out of the ramp and checks them against WCAG's formula in **both** palettes.
It found two real failures in the light mapping and they were fixed by stepping the ramp:

| token | was | ratio | now | ratio |
|---|---|---|---|---|
| `--fg-3` on `--bg-2` | `--ds-n-500` | 4.38:1 | `--ds-n-600` | 7.11:1 |
| `--fg-4` on `--bg-1` | `--ds-n-400` | 2.63:1 | `--ds-n-500` | 4.59:1 |

The dark mapping already cleared both bars and is unchanged. `--fg-4` is held to 3:1 rather than
4.5:1 because it carries captions, placeholders and disabled text — saying that out loud is more
honest than exempting it silently.

**This is not a conformance claim.** It is these pairs, at this ratio, asserted.

## What this repository adds on top of what it imported (spec 046)

The vendored `colors_and_type.css` is the design system as it arrived, and this repository does not
author it — that is the rule the whole file rests on. Three tokens are nevertheless declared in
`app.css`'s own `:root`, because the imported mapping put text below the bar its content deserves
and the alternative was editing somebody else's brand:

| token | resolves to | why |
|---|---|---|
| `--fg-harness` | `--ds-blue-700` | the harness name named a ramp step directly, fine on white at 5.90:1 and **2.70:1** on the dark surface |
| `--bg-accent-strong` | `--ds-blue-700` | the accent fill **that carries text**; white on the plain fill measured 4.25:1 in light and 3.22:1 in dark, and `--ds-blue-700` is the only step in the blue ramp white clears 4.5 on |
| `--fg-link` | `--ds-blue-700` | a link is content; the imported mapping gives 4.25:1 on white and 3.86:1 on the deepest light surface. Light only — dark redeclares it and already passes at 4.65–5.50 |

**The brand's blue is unchanged.** `--ds-blue` remains the fill for everything that carries no text
— carets, the pulsing dots, the timeline bars, the swatches — because non-text contrast is a
different rule (WCAG 1.4.11) and this repository has not measured it.

**And one token was narrowed rather than moved.** `--fg-4` had accumulated sixty-four selectors on
an exemption written for five of them. It now carries disabled controls and placeholders only, at
the 3:1 those are genuinely exempt at; the other fifty-nine pieces of content moved to `--fg-3`.
The ramp is why nothing was invented: there is no step between `--ds-n-500` and `--ds-n-600` in
light, so a raised `--fg-4` would simply have been `--fg-3` under a second name.

`contrast.test.ts` enforces all of it, including an **allowlist**: a selector reaching for `--fg-4`
that does not name a disabled or placeholder state fails CI. The drift that produced this took one
spec at a time and no test could see it, because the exemption lived in a comment.

## The breakpoints, and what each one does (spec 047)

Written down here because they were declared in the stylesheet and described nowhere.

| width | what changes |
|---|---|
| above 1100px | the three-column shell: rail, conversation, trace panel |
| **1100px** | the trace panel becomes an overlay, so the page never scrolls sideways |
| **760px** | the rail stops being a column and waits off-canvas; the header's menu control brings it over the conversation, and the header drops its labels to fit |
| **320px** | the floor this app claims. Below it the app renders as best it can and promises nothing |

**The rail is never hidden.** `display: none` was what the 760px block used to do, and it takes a
thing out of the accessibility tree as well as the layout — which, since the rail is the only route
to five of the seven screens, meant a screen-reader user at a narrow width lost the navigation
rather than finding it collapsed. It is now translated off-canvas and brought back.

**A base rule must be declared before the breakpoint that overrides it.** A media query adds no
specificity, so the same selector declared later in the file wins regardless of the query. This trap
bit three times across specs 020, 046 and 047 — stacked columns that refused to stack, a menu
control invisible at every width — and it is now enforced by `layout.test.ts` rather than
remembered.

### Mobile rail regression repair (#34, observed 2026-10-09)

The mobile backdrop inherited the base `display: none`: positioning it in the breakpoint did not
make it visible. The override now explicitly restores `display: block`. The same off-canvas rail
is `inert` while closed at ≤760px, never on desktop. Opening it expands its content even if the
stored desktop preference is collapsed, without changing that preference. The header control names
the rail through `aria-controls` and reports `aria-expanded`. The existing overlay focus hook gives
the rail initial focus, wraps Tab/Shift+Tab and returns focus on dismissal; Escape, the close
control, outside click and navigation keep their existing dismissal handlers.

**Observed in Chromium 156.0.8078.4, no Azure calls. Verification correction:** the initial
18335 UI origin was outside the BFF's CORS allowlist; its layout/keyboard measurements were real,
but its inspector screenshot did **not** prove replayed chat. Publication checks reran the app on
the documented, allowed `http://127.0.0.1:5173` origin with the recorded-demo BFF on 18334. The
observations below now refer to that successful replay run, not the blocked-origin attempt:

- At **320, 390 and 760 CSS px**, in light and dark: backdrop computed `block`; 18 Tab steps
  skipped the closed rail; 35 forward and 35 reverse steps stayed inside the open rail. Escape,
  outside click and choosing Agents returned focus to the header opener. Document width equalled
  viewport width at each size.
- At **200% native browser zoom** (`chrome.tabs.setZoom`, not CSS zoom or emulated device scale),
  a 1280px browser window reported `innerWidth: 640`, `devicePixelRatio: 2`, `scrollWidth: 640`.
  Opening the rail, Tab containment and Escape focus return passed.
- At **1800px**, the rail was not inert; a collapsed desktop rail expanded in the mobile overlay
  and retained its collapsed preference after returning to desktop. Trace and event inspectors
  were both open with `scrollWidth: 1800`. Screenshots and assertion reports remain session
  artifacts, using only recorded demo content; these checks are not a screen-reader audit.

Regression-first evidence and local gates:

| Exact command | Result |
|---|---|
| `cd frontend && npm test -- src/App.narrow.test.tsx src/styles/layout.test.ts` | RED: 3 failed, 42 passed; GREEN: 45 passed |
| `cd frontend && npm run lint && npm test && npm run build` | Passed: 1040 tests; existing ref-lint and bundle-size warnings |
| `cd backend && ../.venv/bin/ruff check . && ../.venv/bin/ruff format --check . && ../.venv/bin/pytest -q` | Passed: 299 tests, 45 files formatted |
| `cd ai && ../.venv/bin/ruff check . && ../.venv/bin/pytest -q` | Passed: 246 tests, 3 skipped |
| `test -f infra/main.bicep` | Absent: Bicep build/lint skipped |

Python gates used an isolated CPython 3.12.13 environment. Token, contrast and layout gates stayed
green; neither the palette nor the focus-ring rules changed. No live-service behavior was tested.
After local integration of #29's preferences commit, the same gate commands passed again:
**1055 frontend tests**, **299 backend tests**, **246 AI tests / 3 skipped**, with infra still
absent. Both browser scripts were rerun against that integrated tree: the six mobile/theme cases,
desktop inspectors and native 200% zoom checks passed. The allowed-origin run also confirmed
persisted Portuguese and English after reload, a replayed chat with the reasoning summary opened
by the stored preference, its per-turn collapse control, and no `/speech` request or automatic
trace opening.

That real listing exposed one tightly coupled demo regression: at 320px the recording picker
extended to **414px**. Its flex item's intrinsic minimum was wider than the available row. Bounding
the picker to `max-width: 100%` and allowing both picker and select to shrink (`min-width: 0`)
keeps the original labelled native control and tokens. Regression command
`cd frontend && npm test -- src/styles/layout.test.ts`: **RED 1 failed / 35 passed**, then
**GREEN 36 passed**. All six mobile/theme cases again reported document width equal to viewport
width; native 200% zoom and both desktop inspectors passed against actual replay. Final publication
gates, using the exact commands above, passed **1056 frontend tests**, **299 backend tests** and
**246 AI tests / 3 skipped**; infra remained absent. Existing ref-lint/bundle warnings remain.

## The focus ring (spec 048)

Three rules, and no list:

```
*:focus-visible                 the ring — 2px, offset 2px, var(--fg-focus)
.sidebar *, .trace *            redeclare --fg-focus to the lighter step, because those are ink
.log-scrim, .voice-scrim, .main and the composed fields — no ring, each with its reason
```

**The ring is the default and the exceptions are named**, which is the opposite of how spec 040
shipped it. That version was an allowlist, and its own comment described the trap: a control added
later inherits a ring "by belonging to the list rather than by remembering to style it". Belonging
to the list *is* remembering — by the time it was counted, 34 of the 62 rendered control classes
were outside it.

**The colour follows the surface, not the selector.** A second list of sixteen selectors used to
name the controls sitting on ink; they were exactly the descendants of the rail and the trace panel,
so one statement per surface replaced them.

**A focus indicator is measured against what it is drawn on.** With a positive `outline-offset` the
ring sits outside the control, on the background behind it — not on the control's own fill.
Measuring it against the fill reports a blue ring on a blue button as 1.39:1 when it is really
4.17:1 against the surface it touches.

The bar is **3:1**, WCAG 1.4.11's for a non-text indicator — not the 4.5:1 that applies to text.
