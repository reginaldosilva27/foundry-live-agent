# The design system, and the two palettes

> Spec [036](../specs/036-preferences-and-theme/spec.md). What is vendored, what is ours, and why
> the line is where it is.

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
