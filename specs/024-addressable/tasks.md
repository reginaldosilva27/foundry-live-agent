# Tasks: Addressable — the app gets URLs

> Red → green → refactor. Each implementation task is preceded by the test that fails first.

## The scheme

- [x] **T1 — test**: `parseRoute` maps each of the five paths (`/`, `/agents`, `/c/<id>`,
      `/trace/<id>`, `/compare`) to its route, and an unknown path to the chat (AC1)
- [x] **T2 — test**: `parseRoute(buildPath(r))` round-trips every variant (plan)
- [x] **T3 — implement**: `state/route.ts`
- [x] **T4 — test**: no component builds a path by string concatenation (plan, source scan)
- [x] **T5 — implement**: whatever T4 shows is needed

## Wiring the app

- [x] **T6 — test**: loading at each address renders that view (AC1)
- [x] **T7 — implement**: `useRoute`; `App` derives `view` and `activeId` from the route
- [x] **T8 — test**: navigating in the app pushes the address without a reload (AC2)
- [x] **T9 — implement**: `navigate` at every place that currently only sets state
- [x] **T10 — test**: `popstate` returns to the previous view and forward returns (AC3)
- [x] **T11 — implement**: the `popstate` subscription

## Conversations and traces

- [x] **T12 — test**: `/c/<id>` restores messages, `conversation_id` and agent, identically to
      opening from the rail (AC4)
- [x] **T13 — implement**: route-driven restore
- [x] **T14 — test**: an unknown `/c/<id>` renders the chat with the notice, does not redirect and
      creates no conversation (AC7)
- [x] **T15 — implement**: the notice
- [x] **T16 — test**: `/trace/<response_id>` opens the panel on that response (AC5)
- [x] **T17 — implement**: the response id that came from the URL
- [x] **T18 — test**: a response id with no stored turn still opens the panel, requests the spans,
      and says the conversation is not stored here (AC6)
- [x] **T19 — implement**: `TraceDrawer` renders without a turn behind it

## Guards and cross-cutting

- [x] **T20 — test**: after navigation `POST /chat` still carries exactly `message`,
      `conversation_id`, `agent` (AC8 — the §8 guard)
- [x] **T21 — i18n**: the two strings in `en` + `pt` (AC9)
- [x] **T22 — docs**: `docs/architecture.md` route table; `infra/README.md` SPA rewrite requirement
- [x] **T23 — refactor**: keep `App.tsx` readable, or note the extraction as a separate change

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean · tests green · build passes
- [x] Docs updated in the same change (§4)
- [x] All new user-facing text exists in `en` **and** `pt` (§7)
- [x] `spec.md` status updated to `done`
