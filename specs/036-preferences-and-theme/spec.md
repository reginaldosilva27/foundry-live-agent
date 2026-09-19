# Spec: Preferences, and a second theme

| | |
|---|---|
| **ID** | 036-preferences-and-theme |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |
| **Clarified** | 2026-09-19 |

## Problem / motivation

The app has one theme and no preferences. The CSS asks the system exactly one question —
`prefers-reduced-motion` — and answers none of the others. There is no light or dark choice, no way
to say "do not speak answers aloud by default", no way to keep the reasoning card open, no density
control. The two things a reader *can* persist — the collapsed rail (021) and favourite agents (022)
— each grew their own storage key, which is fine at two and a pattern worth naming before it is six.

The theme is the visible half. The Dataside design system already ships both palettes: `--ds-ink`
and `--ds-ink-2` are dark surfaces, `--ds-n-900` through `--ds-n-50` is a full neutral ramp, and the
sidebar already renders dark against a light main column. What is missing is the mapping — the
semantic tokens (`--bg-1`, `--fg-1`, `--border-1`) are defined once, for light, and never redefined.

It matters more than taste. This app is demonstrated on projectors in rooms with the lights down and
screenshotted into documentation, and a reader who cannot match the app to their system is looking at
a white rectangle in a dark room.

## Goals

- **Light and dark**, following the system by default and overridable.
- **A small set of preferences** that persist in this browser: theme, language, and the behaviours a
  reader currently cannot change.
- **One home for browser-kept state**, so the next preference does not invent a fourth storage key.

## Non-goals

- **No deployment configuration here.** Anything from `GET /config` is a fact, not a preference, and
  it is read-only (spec 032 renders it). The two must not be confused on screen — that distinction is
  part of what this app teaches.
- **No server-side preferences.** Nothing travels; nothing is uploaded; there is no account.
- **No theme editor**, no accent picker, no custom CSS. The design system is the design system.
- **No new visual design.** This is the existing screen in a second palette, not a redesign.
- No change to the `AgentEvent` set (§9).

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**Theme** has three states: follow the system, light, dark. Following the system is the default and
tracks a change made while the app is open. A chosen theme persists in this browser and survives a
reload without the page flashing the other palette first.

**The rail does not invert.** It is already the dark surface against a light column, and in dark it
simply becomes the deepest one. The app gains an explicit elevation stack, and separation comes from
that plus a border rather than from a hue change:

```
rail   --ds-ink     #11151C   deepest, recessed
ground --ds-n-900   #121826
card   --ds-ink-2   #1B2230   "elevated dark surface", which is what the DS calls it
raised --ds-n-800   #1F2735
```

Inverting the rail would mean the one element a reader already navigates by changes character
between themes, which is the opposite of what a theme should do.

**Syntax highlighting is mapped, not vendored twice.** The light theme stays
(`highlight.js/styles/github.css`); the dark one is a short override of the same `.hljs-*` classes
in our own stylesheet, under the theme attribute. An `@import` cannot be scoped to an attribute, so
importing a second theme file would simply overwrite the first for both themes. Our own mapping
also keeps colour in one place, which is what the rest of this spec is about.

**Density is not a preference.** The spec's own draft said nobody has asked for it, and that is the
whole argument: a control nobody wants is a control to translate, test and keep working in two
themes forever.

**This is not where the deployment's facts live.** Spec 032's `/about` is read-only and stays its
own screen; the distinction between what *this browser* keeps and what *the deployment* decided is
one of the things this app exists to teach, and a toggle beside a fact would blur it.

**Both themes are complete.** Every semantic token is defined for both, and no colour is defined only
inside a media query — the failure mode being a screen that renders one theme's text on the other
theme's ground. Every state the app can be in is legible in both: the dark rail, the trace panel, the
activity rows, the syntax highlighting, the charts spec 033 adds, and the voice overlay.

**The preferences**, each of which exists because a reader currently cannot change it: whether
answers are spoken by default (spec 008), whether the reasoning card starts open (spec 015), whether
the activity panel starts expanded, and the interface language — which is a preference today that
does not persist, being re-detected from the browser on every load.

**Where they live**: one panel, opened from the rail. It says plainly that these are kept in this
browser only — the same honesty spec 021 and 022 applied to history and favourites.

**With storage unavailable**, every preference still works for the session and nothing throws (022
AC9's rule).

**The first paint is in the chosen theme**, which means a small inline script in `index.html` sets
the attribute on `<html>` before the bundle loads. CSS cannot read storage, so there is no CSS-only
answer; the alternative is a flash of the other palette on every load, which is the bug this rules
out. That script necessarily names the storage key **before any module exists to ask**, so the key
is spelled twice — a deliberate duplication, with a test asserting the two spellings agree (§4).

**The chart palette is re-selected for dark, not flipped.** Spec 033 left this as a debt and it is
paid here. Measured against the dark card surface, all-pairs: three hues hold, and the fourth is
re-stepped because `#A21CAF` falls to 2.52:1 contrast on `#1B2230`.

```
light  #0074FF  #B45309  #00998C  #A21CAF
dark   #0074FF  #B45309  #00998C  #BE2FCF     all checks pass, contrast >= 3:1
```

## Acceptance criteria

1. **AC1** — Theme has three states; the default follows the system.
2. **AC2** — With the theme set to follow, changing the system preference while the app is open
   changes the app.
3. **AC3** — A chosen theme persists across a reload, and the first paint is in the chosen theme.
4. **AC4** — Every semantic colour token is defined in the base declaration, so neither theme
   depends on a media query alone (asserted against the stylesheet).
5. **AC5** — Each preference persists in this browser and takes effect without a reload.
6. **AC6** — Language persists and is used on the next load; with none stored, the browser's
   languages are detected as today.
7. **AC7** — With storage unavailable, every preference works for the session and nothing throws.
8. **AC8** — The panel states that preferences are local to this browser.
9. **AC9** — Nothing in the panel changes anything reported by `GET /config`, and no deployment fact
   is rendered as editable (asserted).
10. **AC10** — Browser-kept state is read and written through one module; no component reads storage
    directly (asserted, and it absorbs the existing rail and favourites keys).
11. **AC11** — Every new string ships `en` + `pt`.
12. **AC12** — The theme attribute is set before first paint, and the storage key the inline script
    reads is the same one the storage module writes (asserted against both files).
13. **AC13** — The chart series tokens are redefined for dark, and the dark set's validation is
    recorded (spec 033's debt).
14. **AC14** — Syntax highlighting is legible in both themes, and the dark mapping uses design
    tokens rather than a second vendored theme file.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). Nothing travels. |
| **Stored data** | A preferences key joins `fla.history.v1` and `fla.favourites.v1`. One module owns every key and its shape (§4); the existing two move behind it without changing their keys or their data. |
| **Design tokens** | `public/ds/colors_and_type.css` is the design system's file, imported as given. The dark mapping of the semantic layer is **ours** and belongs in the app's stylesheet, not in the vendored file — editing the vendored one would lose the change on the next import (§4). |
| **Docs** | `docs/design-system.md` — the second palette and the token contract it depends on. |

## Out of scope / deferred

- Any preference that changes what the agent does.
- Theming beyond light and dark.
- Syncing preferences anywhere.
- A density control — speculation, by the draft's own admission.
