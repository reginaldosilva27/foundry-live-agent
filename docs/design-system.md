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
