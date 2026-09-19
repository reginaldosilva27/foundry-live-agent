# Plan: What this build is talking to

> The HOW, written after `spec.md` reached `clarified` (2026-09-19).

## Approach

A fifth read-only screen, at `/about`, rendering `GET /config` and nothing else. There is **no
backend change at all** — clarify resolved every open question without needing a new field, so this
spec is frontend-only apart from the docs.

The one idea worth calling out is **AC1's drift test**. "Renders every field the config returns" is
the kind of criterion that rots silently: spec 031 added `agents.can_promote` three days ago and
nothing would have noticed if this panel had shipped first. So the panel declares the keys it
covers, and a test reads `backend/app/routers/config.py` and asserts the two sets match — the same
arrangement `types/agents.test.ts` already uses to keep the agents mirror honest (§4). Adding a
field to `/config` then fails *here*, with a message naming the field.

**Alternative rejected:** rendering the config generically — walk the object, print every key.
Needs no drift test and can never miss a field, but §7 requires a translated label for every field
and §5 requires "not reported" to be distinguishable from a falsy value, neither of which survives a
generic walk. It would also print `pricing.rates` as a blob of numbers. The panel is written, and
the test keeps it honest.

**`pricing` is deliberately not priced on this panel.** Spec 028 owns how money renders, and a
second place that formatted rates would be the §4 drift this spec's own AC1 is about. The panel
reports **that** a rate table is configured and the date it was read — a fact about the deployment —
and leaves the numbers to the turn-cost feature that owns them.

## Affected files

- `frontend/src/state/route.ts` — `{ name: 'about' }`, `/about`, in `ROUTES`, `parseRoute`,
  `buildPath`.
- `frontend/src/panes/About.tsx` (new) — the panel.
- `frontend/src/panes/aboutFields.ts` (new) — `COVERED_CONFIG_KEYS`, AC1's machinery, in its own
  module so `About.tsx` exports components only.
- `frontend/src/panes/About.test.tsx` (new).
- `frontend/src/panes/About.coverage.test.ts` (new) — the drift test, reading the Python.
- `frontend/src/panes/Sidebar.tsx` — the footer gains a link; its two lines stay (AC7).
- `frontend/src/App.tsx` — the `about` branch.
- `frontend/src/i18n/strings.ts` — labels, section titles, the states, the event-contract prose.
- `frontend/src/styles/app.css` — the panel.
- `docs/architecture.md` — the panel is the screen version of that page.

Not touched: `backend/`, `ai/`, `contract.py` (§9).

## Contract / data model changes (constitution §4)

None on the wire. Two single-source-of-truth relationships are *created* and both are tested:

| Fact | Source of truth | Kept honest by |
|---|---|---|
| Which fields `GET /config` carries | `backend/app/routers/config.py` | `About.coverage.test.ts` reads it and fails on an unrendered field |
| The event vocabulary | `ai/harness/_shared/contract.py` → `config.event_types` | the panel renders the array it is sent; it keeps no list (§9) |

## i18n strings (constitution §7)

Section titles and states: `about.title` · `about.lead` · `about.loading` · `about.failed` ·
`about.notReported` · `about.yes` · `about.no` · `about.whoAnswers` · `about.routing` ·
`about.observable` · `about.voice` · `about.contract` · `about.mayChange`.

Field labels: `about.field.project` · `agent` · `agentVersion` · `harness` · `model` ·
`usesGateway` · `tracing` · `gatewayLogged` · `speech` · `voiceEnabled` · `webrtcApiVersion` ·
`pricing` · `pricingRecorded` · `canPromote`.

Event contract: `about.events.types` · `about.events.count` · `about.events.unverified` ·
`about.events.allVerified` · `about.events.note` (the sentence that replaces a link, AC12).

Sidebar: `sidebar.about`.

`about.field.harness` joins `INTENTIONALLY_IDENTICAL`: *harness* is this repository's own term,
used as a proper noun in the docs, the code and `GET /config`'s own field. Translating the metaphor
would lose a reader comparing the panel with the endpoint.

Full `en`/`pt` pairs live in `strings.ts`; `strings.test.ts` is the gate (AC9).

## Test strategy (constitution §2 — TDD)

| AC | Test | File |
|---|---|---|
| AC1 | every key `config.py` sends has a label the panel renders; an unrendered field fails by name | `About.coverage.test.ts` |
| AC2 | the panel renders zero `button`/`input`/`select`/`textarea`, and issues no `fetch` | `About.test.tsx` |
| AC3 | verified count, total, and each unverified name rendered individually | `About.test.tsx` |
| AC4 | nothing unverified → the "all verified" sentence, and no empty list | `About.test.tsx` |
| AC5 | a config missing an optional field renders "not reported", not `no` | `About.test.tsx` |
| AC6 | loading and failed are different rendered states | `About.test.tsx` |
| AC7 | the footer still shows model + gateway, and offers the link | `Sidebar.test.tsx` |
| AC8 | voice off + tracing off + no gateway renders every line, none omitted | `About.test.tsx` |
| AC9 | both languages | existing `strings.test.ts` |
| AC10 | `/about` round-trips through `parseRoute`/`buildPath`; the app renders it on load | `route.test.ts`, `App.routing.test.tsx` |
| AC11 | no editable control; no preferences on the panel | `About.test.tsx` (shares AC2's assertion) |
| AC12 | the note renders; the panel contains no `<a href>` | `About.test.tsx` |

**AC5 is the subtle one.** `tracing?`, `pricing?` and `agents?` are optional on `BffConfig`, and
`false` must render as *no* while absent renders as *not reported*. The assertion compares the
row's rendered value **exactly**, because "not reported" contains "no" as a substring and
`toHaveTextContent` would pass either way.

## Risks / trade-offs

- **The drift test reads Python with a regex.** Same technique as `types/agents.test.ts`, same
  weakness: a sufficiently creative rewrite of `config.py` could slip past it. It catches the
  realistic case — someone adds a key to the dict — which is what spec 031 did.
- **`pricing` reported but not priced** may read as a gap to someone expecting numbers. The label
  says a rate table is configured and when it was read; spec 028 owns the rest.
- **A fifth screen is a fifth thing to keep accessible** (spec 040). It is an ordinary page of
  definition lists, which is the cheapest possible thing to make accessible.
