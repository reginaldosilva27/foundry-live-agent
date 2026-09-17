# Plan: The keyboard — shortcuts and a command palette

> The HOW. Written after `spec.md` is `clarified`.

## Approach

**One table is the whole feature.** `frontend/src/state/keys.ts` holds every binding as data: the
key, whether it needs a modifier, the command it runs, and the string key for its label. The handler
reads it, the palette reads it, and the tooltips read it. A second list of keys anywhere is the §4
violation this spec is most likely to commit, so a source scan asserts there is not one.

**The bindings.**

| Key | Does | Scope |
|---|---|---|
| `⌘K` / `Ctrl+K` | open the palette | anywhere, including inside a field |
| `⌘B` / `Ctrl+B` | collapse or expand the rail | no field focused |
| `/` | focus the composer | no field focused |
| `n` | new conversation | no field focused |
| `t` | open or close the trace panel | no field focused |
| `←` `→` | previous / next turn in the trace panel | no field focused, panel open |

**`Esc` is not in the table**, which is a correction this plan owes the reader: the first sketch had
it, and writing the §4 source scan found the reason it cannot be there. `Escape` already has four
owners — the payload reader, `useModalFocus`, the agent chip's menu, the history rename — and each
closes the thing the reader is actually in. That is component behaviour, not an app-wide command; a
global handler would collide with all four. The palette takes its `Escape` from `useModalFocus`, as
the other overlays do. Spec 023's clarify had already found this and the plan had forgotten it.

No other chord. `⌘⇧N` was in the first sketch and is out: it is a new incognito window, captured
above the page, and the spec's own goal says nothing overrides a browser default the reader relies
on. `⌘K` is the one chord a browser also claims (Chrome focuses the omnibox) and it is kept, because
every comparable app binds it, the page wins while it has focus, and the reader's alternative is one
visible control away.

**Single letters are safe precisely because of the focus rule.** `n` and `t` would be unusable in a
chat app that let them fire while someone types. The guard is one predicate — is the active element
a text field or `contenteditable` — and it is tested directly rather than trusted.

**The palette** is a dialog over the app with one field and a flat, grouped list. Its entries come
from three sources the app already has, and it derives nothing of its own: **agents** from
`useAgents` (with `selectable` and `reason` exactly as the listing gives them — §4), **conversations**
from `useHistory` (titles, per the clarified decision), and **actions** from the key table plus the
handful that have no key. An entry that cannot run renders disabled with its reason and is skipped
by the arrow keys, so Enter can never land on something that would fail.

**Filtering** is a case- and accent-insensitive substring match. Accent folding is not optional in a
`pt` interface: a reader typing `agentes` must match `Agentes`, and typing `conversa` must match a
title with `conversação` in it.

**Focus** uses the existing `useModalFocus` hook — the palette is the fourth overlay in the app and
does not need a fifth focus implementation (§4). Escape closes it and returns focus where it was.

**Rejected:** a global key-capture library (seven bindings); binding shortcuts per component, which
is how the key table stops being the source of truth; a palette that runs a tool or composes a
prompt, which the spec rules out as the app deciding (§8); fuzzy matching, which makes the disabled
entries harder to reason about for no gain at this size.

## Affected files

- `frontend/src/state/keys.ts` — **new.** The binding table, the `Command` union, the
  "is a field focused" predicate. Pure.
- `frontend/src/hooks/useKeys.ts` — **new.** One `keydown` listener over the table, dispatching
  commands.
- `frontend/src/panes/CommandPalette.tsx` — **new.** The dialog, the field, the grouped list.
- `frontend/src/state/palette.ts` — **new.** Builds the entry list from agents, history and actions,
  and filters it. Pure, so the matching is tested without a DOM.
- `frontend/src/App.tsx` — wires `useKeys` to the commands it already has handlers for; renders the
  palette; passes the composer a ref so `/` can focus it.
- `frontend/src/panes/Composer.tsx` — accepts a forwarded ref for the focus command.
- `frontend/src/panes/Sidebar.tsx` — the palette's own control, and shortcut hints in tooltips.
- `frontend/src/components/Icon.tsx` — `CommandIcon`.
- `frontend/src/i18n/strings.ts` — the strings below.
- `frontend/src/styles/app.css` — the palette.
- `docs/design-system.md` — the bindings and the focus behaviour join the layout contract.

## Contract / data model changes (constitution §4)

**No BFF change.** No endpoint, no request field, no event (§9).

`state/keys.ts` is the single source of truth for the bindings. The palette labels, the tooltips and
the handler all read it; a test scans the sources for key literals (`'Escape'`, `'k'`, …) outside it.

Selectability stays the BFF's: the palette renders `selectable` / `reason` as the listing gives them
and re-derives nothing (§4, spec 019's rule).

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `palette.open` | Commands | Comandos |
| `palette.placeholder` | Search agents, conversations and actions | Buscar agentes, conversas e ações |
| `palette.empty` | Nothing matches that. | Nada corresponde a isso. |
| `palette.agents` | Agents | Agentes |
| `palette.conversations` | Conversations | Conversas |
| `palette.actions` | Actions | Ações |
| `keys.focusComposer` | Write a question | Escrever uma pergunta |
| `keys.newConversation` | New conversation | Nova conversa |
| `keys.toggleTraces` | Traces | Traces |
| `keys.toggleRail` | Collapse the rail | Recolher a barra |
| `keys.openPalette` | Commands | Comandos |
| `keys.language` | Switch language | Trocar idioma |
| `keys.startVoice` | Start a voice session | Iniciar sessão de voz |

## Test strategy (constitution §2 — TDD)

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 | each binding runs its command with the app focused | `hooks/useKeys.test.tsx` |
| AC2 | no binding fires while a text field is focused, except the field-scoped ones | `hooks/useKeys.test.tsx`, `state/keys.test.ts` |
| AC3 | every command in the table is also reachable by an on-screen control | `App.keyboard.test.tsx` |
| AC4 | the palette opens by key and by control, closes on Escape, restores focus | `panes/CommandPalette.test.tsx` |
| AC5 | typing filters across the three groups; arrows move; Enter runs | `state/palette.test.ts`, `panes/CommandPalette.test.tsx` |
| AC6 | choosing an agent selects it and starts a new conversation, from either view | `App.keyboard.test.tsx` |
| AC7 | choosing a conversation restores it exactly as the rail does | `App.keyboard.test.tsx` |
| AC8 | an unselectable agent renders its reason and cannot be run; voice disabled renders unavailable | `panes/CommandPalette.test.tsx` |
| AC9 | focus is trapped while open and returned on close | `panes/CommandPalette.test.tsx` |
| AC10 | en + pt for every new key | `i18n/strings.test.ts` (existing) |
| — (plan) | no binding uses a chord the browser reserves | `state/keys.test.ts` |
| — (plan) | no key literal outside `state/keys.ts` | `state/keys.test.ts` (source scan) |
| — (plan) | filtering folds accents and case | `state/palette.test.ts` |

## Risks / trade-offs

- **`⌘K` is contested.** The page wins while it has focus, which is every case that matters here, and
  the palette has a visible control for the case it does not.
- **Single-letter bindings are only as safe as the focus predicate.** It is the one piece of this
  that breaks quietly — a new field type that the predicate does not recognise makes `n` fire while
  someone types. Tested against `input`, `textarea` and `contenteditable` directly.
- **The palette duplicates navigation that already exists**, on purpose. The risk is drift: a fourth
  way to choose an agent that behaves slightly differently. Mitigated by routing every palette
  action through the *same* handlers the rail and the screens call — asserted in AC6 and AC7 by
  comparing outcomes, not implementations.
- **Accent folding via `normalize('NFD')`** is correct for Portuguese and is not a general
  collation. Stated because someone will eventually ask why it is not `Intl.Collator`.
