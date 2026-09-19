# Plan: Preferences, and a second theme

> The HOW, written after `spec.md` reached `clarified` (2026-09-19).

## Approach

Four pieces, in dependency order.

**1. One home for browser-kept state.** `state/storage.ts` gains a `KEYS` registry and every key
moves behind it — `fla.history.v1`, `fla.favourites.v1`, `fla.ui.v1` keep their exact spellings and
their data, so nothing a reader has stored is lost. A test asserts no `localStorage` call and no
`'fla.` literal exists outside that module. This is AC10, and it is what stops the next preference
inventing a fifth key.

**2. The semantic layer, defined twice.** `public/ds/colors_and_type.css` is vendored and stays
untouched — editing it would lose the change on the next import. The **mapping** is ours, so
`app.css` declares every semantic token for light in `:root` and redefines the set under
`:root[data-theme='dark']`. A media query handles "follow the system" by setting the same block for
`prefers-color-scheme: dark` when no explicit attribute is present. AC4's assertion — no colour
defined only inside a media query — is a test over the stylesheet.

**3. The preference store.** `state/preferences.ts`: one object, one key, one hook. Theme is applied
by writing `data-theme` on `<html>`, which is the same attribute the inline script sets, so there is
one mechanism and not two.

**4. The panel**, at `/preferences`, beside `/about`.

**The inline script** in `index.html` is six lines, wrapped in try/catch, and reads the key before
the bundle loads. It is the only way to avoid a flash, and the duplicated key literal is covered by
a test that reads both files.

## Affected files

- `frontend/index.html` — the pre-paint script.
- `frontend/src/state/storage.ts` — the key registry; `history.ts`, `favourites.ts`, `ui.ts` import
  from it.
- `frontend/src/state/preferences.ts` (new) + test.
- `frontend/src/panes/Preferences.tsx` (new) + test.
- `frontend/src/state/route.ts` — `{ name: 'preferences' }`.
- `frontend/src/App.tsx`, `frontend/src/panes/Sidebar.tsx` — the branch and the way in.
- `frontend/src/styles/app.css` — the dark mapping, the hljs override, the panel.
- `frontend/public/ds/colors_and_type.css` — `--ds-series-*` gain dark values… **no**: the dark
  values are ours, so they live in `app.css` under the theme attribute, beside the rest of the
  mapping. The vendored file keeps only the light set it already has.
- `frontend/src/i18n/strings.ts`.
- `docs/design-system.md` (new) — the token contract and the two palettes.

## Contract / data model changes (§4)

Nothing travels (§9 untouched). Stored shape:

```ts
interface Preferences {
  theme: 'system' | 'light' | 'dark'
  lang?: 'en' | 'pt'        // absent means "detect", which is today's behaviour
  speakAnswers: boolean
  reasoningOpen: boolean
  activityOpen: boolean
}
```

`lang` is optional on purpose: absent and `'en'` are different facts, and absent must keep detecting
from the browser (AC6).

## i18n strings (§7)

`prefs.title` · `prefs.lead` (kept in this browser only) · `prefs.theme` · `prefs.theme.system` ·
`prefs.theme.light` · `prefs.theme.dark` · `prefs.language` · `prefs.speakAnswers` ·
`prefs.reasoningOpen` · `prefs.activityOpen` · `sidebar.preferences`.

## Test strategy (§2 — TDD)

| AC | Test | File |
|---|---|---|
| AC1/AC5 | three states, default `system`, each persists and applies without reload | `preferences.test.ts` |
| AC2 | with `system`, a change to the media query changes the attribute | `preferences.test.ts` |
| AC3/AC12 | the attribute is set from storage, and `index.html`'s key matches the module's | `preferences.test.ts` |
| AC4 | every semantic token is declared in the base `:root`, not only in a media query | `styles/layout.test.ts` |
| AC6 | stored language is used; absent keeps detecting | `preferences.test.ts` |
| AC7 | with storage throwing, every preference works and nothing throws | `preferences.test.ts` |
| AC8 | the panel says the preferences are local | `Preferences.test.tsx` |
| AC9 | the panel renders nothing from `GET /config` | `Preferences.test.tsx` |
| AC10 | no `localStorage` and no `'fla.` literal outside `storage.ts` | `storage.test.ts` |
| AC13 | `--ds-series-*` are redefined under the dark attribute | `styles/layout.test.ts` |
| AC14 | the dark hljs mapping exists and names tokens, not literals | `styles/layout.test.ts` |

## Risks / trade-offs

- **The duplicated key literal** in `index.html` is a real §4 compromise, accepted because the
  alternative is a visible flash on every load, and covered by a test.
- **Redefining `--ds-series-*` in `app.css`** means the light values live in the vendored file and
  the dark ones in ours. Stated in `docs/design-system.md`; the alternative is editing a vendored
  file, which is worse.
- **Every screen must be checked in dark**, and a test cannot see colour. The charts are rendered
  and looked at, as spec 033's were.
