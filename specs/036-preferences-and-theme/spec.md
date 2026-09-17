# Spec: Preferences, and a second theme

| | |
|---|---|
| **ID** | 036-preferences-and-theme |
| **Status** | draft |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

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

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). Nothing travels. |
| **Stored data** | A preferences key joins `fla.history.v1` and `fla.favourites.v1`. One module owns every key and its shape (§4); the existing two move behind it without changing their keys or their data. |
| **Design tokens** | `public/ds/colors_and_type.css` is the design system's file, imported as given. The dark mapping of the semantic layer is **ours** and belongs in the app's stylesheet, not in the vendored file — editing the vendored one would lose the change on the next import (§4). |
| **Docs** | `docs/design-system.md` — the second palette and the token contract it depends on. |

## Open questions (clarify before planning)

- [ ] Does the dark theme invert the rail, which is already dark? A dark rail on a dark ground needs a
      different separation than a dark rail on a light one.
- [ ] Which `highlight.js` theme for dark, and does the light one stay?
- [ ] Is density a real preference or speculation? Nobody has asked for it.
- [ ] Does this panel share a home with spec 032's connection panel, or stay separate to keep the
      "this browser" versus "this deployment" distinction sharp?
- [ ] How is the first-paint flash avoided — an inline script before the app mounts, or a CSS-only
      approach that cannot know a stored choice?

## Out of scope / deferred

- Any preference that changes what the agent does.
- Theming beyond light and dark.
- Syncing preferences anywhere.
