# Tasks: Favourite agents

> Red → green → refactor.

## Tasks

- [x] **T1 (test)** — `state/favourites.test.ts`: toggling adds and removes a name; the list is read
      back after a remount; `favouriteRows` resolves names against the listing, keeps the listing's
      order and `selectable`/`reason`, and drops a name the listing lacks without forgetting it;
      with storage throwing, toggling still works in memory. *(AC3, AC7, AC8, AC9)*
- [x] **T2 (impl)** — `state/favourites.ts`.
- [x] **T3 (test)** — `panes/AgentsScreen.test.tsx`: a star per card, named for the action and the
      agent; starring calls `onFavourite` and not `onSelect`; a favourited card's star says
      "remove"; the 019 cases (dimmed, inert, reasoned) still hold on the restructured card.
      *(AC1, AC2, AC3)*
- [x] **T4 (impl)** — `StarIcon`; the card becomes a container with its own selectable control.
- [x] **T5 (test)** — `panes/Favourites.test.tsx`: the group renders favourites with their
      monograms; no favourites means no group and no heading; an unselectable favourite is rendered
      and inert; choosing one calls back. *(AC4, AC6)*
- [x] **T6 (impl)** — `panes/Favourites.tsx`, rendered by `Sidebar`.
- [x] **T7 (test)** — `App.shell.test.tsx`: starring on the agents screen puts the agent in the
      rail; choosing it there selects it and resets the conversation. *(AC5)*
- [x] **T8 (impl)** — `useFavourites()` in `App`, wired to both surfaces.
- [x] **T9 (i18n)** — the three keys in `en` + `pt`. *(AC10)*
- [x] **T10 (style)** — the star, the card head, the rail group; collapsed rail shows monograms only.
- [x] **T11 (docs)** — `docs/design-system.md` layout contract; `specs/README.md` index.
- [x] **T12 (verify)** — `verify-gates`, plus a look at the real app at 1280 and 1440.

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean · tests green · build passes
- [x] Docs updated in the same change (§4)
- [x] All new user-facing text exists in `en` **and** `pt` (§7)
- [x] `spec.md` status → `done`
