# Plan: Favourite agents

> The HOW for `spec.md`. Frontend only, and small: one storage module, one control, one rail group.

## Approach

Favourites are **names**, not agents. Storing a copy of a row would mean the rail could render a
version, a status or a harness the project has since changed — a second, staler source of truth for
something `GET /agents` already answers (§4). The stored list is `string[]`; every render resolves
each name against the current listing and drops what the listing does not have (AC7).

That resolution is a pure function, `favouriteRows(agents, names)`, and it is where AC6 and AC7 both
live: it returns rows, in the listing's order, carrying the listing's own `selectable` and `reason`.
Nothing about starring can make an agent choosable.

The star is a `<button>` **inside** the card's `<button>`. Nesting interactive elements is invalid
HTML, so the card stops being a button: it becomes a `<div>` with the selectable part as its own
control. That is a small restructure of `AgentsScreen`, and the 019 tests that assert a dimmed card
is `disabled` and inert move onto that inner control rather than being weakened.

Storage reuses `state/storage.ts` from spec 021 — `readJson` / `writeJson`, every call already
wrapped, which is all AC9 needs.

## Affected files

**New**

- `frontend/src/state/favourites.ts` — the key, `favouriteRows()`, and `useFavourites()`.
  + `favourites.test.ts`.
- `frontend/src/panes/Favourites.tsx` — the rail group. + `Favourites.test.tsx`.

**Changed**

- `frontend/src/components/Icon.tsx` — `StarIcon` (outline and filled, one component, `filled` prop).
- `frontend/src/panes/AgentsScreen.tsx` — the card becomes a container; the star sits top-right; the
  selectable region is the control. + its test follows the restructure.
- `frontend/src/panes/Sidebar.tsx` — renders `Favourites` under the answering agent.
- `frontend/src/App.tsx` — owns `useFavourites()`, passes it to both.
- `frontend/src/i18n/strings.ts` — three keys.
- `frontend/src/styles/app.css` — the star, the card's new head layout, the rail group.
- `docs/design-system.md`, `specs/README.md`.

## Contract / data model changes (constitution §4)

```ts
// localStorage key: `fla.favourites.v1`
type StoredFavourites = string[]   // agent NAMES, resolved against GET /agents on every render
```

No HTTP contract changes. No `AgentEvent` change. `HARNESS_FOR_KIND` remains the only place
kind → harness is decided; favourites render `selectable`/`reason` as given.

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `agents.favourite` | Add {name} to favourites | Adicionar {name} aos favoritos |
| `agents.unfavourite` | Remove {name} from favourites | Remover {name} dos favoritos |
| `favourites.title` | Favourites | Favoritos |

## Test strategy (constitution §2 — TDD)

| AC | Test | File |
|---|---|---|
| AC1 | each card has a star whose accessible name names the action and the agent | `panes/AgentsScreen.test.tsx` |
| AC2 | starring calls `onFavourite` and **not** `onSelect` | `panes/AgentsScreen.test.tsx` |
| AC3 | starring a favourite unfavourites it | `panes/AgentsScreen.test.tsx`, `state/favourites.test.ts` |
| AC4 | the group renders favourites; with none, no heading and no group | `panes/Favourites.test.tsx` |
| AC5 | choosing one selects it and resets the conversation, from either view | `App.shell.test.tsx` |
| AC6 | an unselectable favourite is rendered and inert | `panes/Favourites.test.tsx` |
| AC7 | `favouriteRows` drops a name the listing lacks; storage still holds it | `state/favourites.test.ts` |
| AC8 | remount reads the list back | `state/favourites.test.ts` |
| AC9 | with storage throwing, toggling still updates the list in memory | `state/favourites.test.ts` |
| AC10 | new keys in both languages; no glyph star | `i18n/strings.test.ts`, `brand.test.ts` (existing) |

## Risks / trade-offs

- **The card stops being one button.** The 019 criteria that matter — listed, dimmed, inert, with a
  reason — must keep passing on the inner control, not be quietly relaxed. If a moved assertion has
  to change to pass, that is a behaviour change and belongs in this spec's criteria.
- **A stale favourite is invisible rather than announced.** The app cannot tell "deleted" from "not
  listed right now" (a permission change, a transient failure), so it says nothing and keeps the
  name (AC7). Announcing a deletion we cannot confirm would be the §5 violation.
- **Three localStorage keys now.** Each is separately readable and separately failing; `storage.ts`
  already absorbs all three failure modes, and no key depends on another.
