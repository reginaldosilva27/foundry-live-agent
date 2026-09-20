# Plan: Side by side — one question, two agents, two streams

> The HOW. Written after `spec.md` is `clarified`. Decisions here must respect every
> principle in `.specify/constitution.md`; if one must bend, amend the constitution
> first and note it.

## Approach

**Two streams, and nothing else changes.** The spec's contract section names the choice — one
multiplexed stream, or one stream per agent — and says the second "should be preferred precisely
because it needs no contract change". Reading the code confirms it needs none at all:

- `POST /chat` already takes `agent` per request (spec 019) and resolves the harness **per request**,
  never by mutating `app.state.harness`. Two concurrent posts are two independent turns already.
- `useAgentStream` already owns exactly one turn, one `conversation_id` and one abort controller.
  Two instances are two independent conversations, which is **AC10 by construction** rather than by
  a rule someone has to keep.
- One column erroring cannot touch the other, because they share no state — **AC8 by construction**.

So the whole spec is a **frontend composition**: a second instance of a hook, a second `Conversation`
beside the first, and one composer that calls both. There is no backend diff, no `AgentEvent` diff,
and no new endpoint. That is the finding worth writing down, because the spec was written expecting
a transport decision and there isn't one to make.

**Three things genuinely are new**, and they are the only places this plan spends design:

1. **Turn ids must not collide.** Each `useAgentStream` mints `turn_0`, `turn_1` from its own
   counter, so two instances both produce `turn_0`. The trace panel, the event inspector and the log
   reader all address a turn by id, and two turns sharing one would open the wrong payload. So
   `useAgentStream` takes an **id prefix** (default `turn`, i.e. today's ids unchanged) and the two
   columns use `left` and `right`. Everything that addresses a turn keeps working across both
   columns with no second lookup path (§4).
2. **Time to first token does not exist yet.** AC4 asks for it; nothing in the app measures it.
   `AgentMessage` gains `firstTokenAt`, stamped when the first `text_delta` lands, and `MetaLine`
   renders the difference when there is one. It is the browser's clock — the same clock
   `latencyMs` already uses, and deliberately **not** laid over spans, which is the two-clocks
   picture spec 029 refused.
3. **The columns need a screen.** `/compare` already parses (`route.ts` reserved it for this spec)
   and `docs/architecture.md` already documents it as reserved. Both stop being a reservation.

**What is already true, and is not work.** Clarify decision #1 — *the activity panel gives way, each
column carries its own activity inline* — was implemented by spec 021: `ActivityPanel` renders
**inside** each turn in `Conversation` today, not as a shared third pane. So AC3's second half holds
in the single-agent view already, and AC3's first half is satisfied by rendering `Conversation`
itself rather than a column component that reimplements it. Likewise **AC5** (executor tags) is
`ToolRow`'s existing `data-testid="executor-tag"`, and **AC12** (a hosted column's cost excludes
container compute) is `MetaLine`'s existing `cost.excludesContainer`, which spec 028 added for this
exact reason. This spec's job there is to *pass the right `harness` per column* and assert the
result — not to write the sentence again.

**Alternative rejected: one screen that reimplements the turn.** A `CompareColumn` component
rendering its own reasoning card and tool rows was the obvious shape and is the §4 violation the
spec names outright — "a second copy of the activity rendering would drift within a release".
`Conversation` already takes `messages`, `agent`, `harness`, `model`, `pricing` and `onOpenTrace` as
props; two of them side by side is the whole feature.

**Alternative rejected: `Compare` owns its own trace drawer.** Self-contained is tempting, but the
drawer's wiring (which turn, which call, the spans fetch, the step navigation) would then exist
twice. Instead `App` keeps the one drawer and reads from *the messages on screen* — the chat's in
chat mode, both columns' concatenated in compare mode. The prefix from (1) is what makes that
concatenation safe.

## Affected files

- `frontend/src/hooks/useAgentStream.ts` — an optional id prefix; `firstTokenAt` stamped on the
  first `text_delta`. Both default to today's behaviour exactly.
- `frontend/src/hooks/useComparison.ts` — **new**. Owns the two streams, the second agent, and the
  two operations that must hit both: send and stop. Holds no rendering.
- `frontend/src/panes/Compare.tsx` — **new**. The screen: the second-agent picker, two
  `Conversation` columns, one `Composer`. Contains no turn rendering of its own.
- `frontend/src/panes/Conversation.tsx` — passes `firstTokenMs` to `MetaLine`; an optional
  `aria-label` so a screen reader can tell the two columns apart.
- `frontend/src/components/MetaLine.tsx` — renders time to first token when the turn produced one.
- `frontend/src/panes/Sidebar.tsx` — `compare` joins the nav list and the `View` union.
- `frontend/src/App.tsx` — `view === 'compare'` renders `Compare`; the trace/event surfaces read
  the messages on screen; voice is refused with a reason while comparing.
- `frontend/src/i18n/strings.ts` — the new strings, `en` + `pt`.
- `frontend/src/app.css` (+ `styles/layout.test.ts` stays green) — the two-column grid. Tokens only,
  no colour literals (spec 036).
- `frontend/src/a11y.test.tsx` — the compare screen joins the screens walked on every commit.
- `docs/architecture.md` — `/compare` stops being "reserved".
- `docs/harness-comparison.md` — gains the section AC16 will fill, and says today it is unfilled.
- `docs/REFERENCES.md` — AC16's live run as an open item, with what closes it.
- `specs/README.md` — the index table's stale statuses for 020 and 027–045.

## Contract / data model changes (constitution §4)

| | |
|---|---|
| **`AgentEvent` (§9)** | **Unchanged.** Two streams of the same nine events. |
| **`POST /chat`** | **Unchanged** — no fourth field, no new route, no multiplexing. Two ordinary requests, each already carrying `agent` and its own `conversation_id`. The backend diff for this spec is empty, and a test asserts the two columns' requests name two different agents and share no conversation id. |
| **Turn ids** | `useAgentStream`'s prefix is the single source of the id scheme; `callKey` in `state/turn.ts` stays the single source of how a *call* is addressed. Nothing else learns to parse an id. |
| **`firstTokenAt`** | Lives on `AgentMessage` beside `startedAt`/`endedAt` — the same clock, the same owner. `MetaLine` is the only place it is turned into a figure. |
| **Docs** | `docs/architecture.md`'s route table and `docs/harness-comparison.md` move in this change. |

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `nav.compare` | Compare | Comparar |
| `compare.title` | Side by side | Lado a lado |
| `compare.lead` | One question, two agents, two streams. The app shows both and picks no winner. | Uma pergunta, dois agentes, dois streams. O app mostra os dois e não escolhe um vencedor. |
| `compare.with` | Compare with | Comparar com |
| `compare.pick` | Choose a second agent | Escolha um segundo agente |
| `compare.needsSecond` | Choose a second agent to ask them both. | Escolha um segundo agente para perguntar aos dois. |
| `compare.column` | Answers from {agent} | Respostas de {agent} |
| `compare.voiceUnavailable` | Voice is unavailable while comparing. | A voz não está disponível durante a comparação. |
| `meta.firstToken` | to first token | até o primeiro token |

`compare.noVerdict` is deliberately **not** a string: the app says nothing about which answer is
better, and a sentence explaining that it is not judging would still be the screen talking about the
answers. `compare.lead` carries it once, where it is a description of the screen.

## Test strategy (constitution §2 — TDD)

New files: `frontend/src/panes/Compare.test.tsx` (the screen, against a faked BFF that answers the
two agents with two different streams) and `frontend/src/hooks/useAgentStream.ids.test.ts` (the
prefix). Existing suites must pass **unchanged** — that is AC14, and it is checked by not editing
them except to add the compare screen to `a11y.test.tsx`.

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 | one send ⇒ two `POST /chat`, same `message`, neither awaiting the other | `Compare.test.tsx` |
| AC2 | the two fixtures differ; each column renders only its own text, tool rows and usage | `Compare.test.tsx` |
| AC3 | each column renders `ActivityPanel`'s rows inline; no shared activity pane exists | `Compare.test.tsx` |
| AC4 | a settled column shows first token, duration, tokens and cost; a turn with no usage shows no zero | `Compare.test.tsx`, `MetaLine.test.tsx` |
| AC5 | the same tool name in both columns carries `bff` in one and `foundry` in the other | `Compare.test.tsx` |
| AC6 | a column whose stream carries no `reasoning_summary` and no `mcp_call` renders with no error | `Compare.test.tsx` |
| AC7 | each column's trace link opens the drawer on **that** run's `response_id` | `Compare.test.tsx` |
| AC8 | the right fetch rejects; the right column errors and the left still reaches `done` | `Compare.test.tsx` |
| AC9 | stop mid-turn ⇒ both columns settle, neither stays `streaming` | `Compare.test.tsx` |
| AC10 | the two requests carry no `conversation_id` in common, on the first turn and the second | `Compare.test.tsx` |
| AC11 | two agents of the same kind compare, and the picker disables neither | `Compare.test.tsx` |
| AC12 | the hosted column carries `cost.excludesContainer`; the prompt column does not | `Compare.test.tsx` |
| AC13 | the voice control is disabled and names the reason in the active language | `Compare.test.tsx` |
| AC14 | leaving `/compare` returns the chat with its own transcript intact | `Compare.test.tsx` |
| AC15 | every new key exists in `en` and `pt` | `strings.test.ts` (existing, automatic) |
| AC16 | **met 2026-09-20** — `ai/scripts/compare_harnesses.py`, 6 recorded turns | `ai/tests/fixtures/recorded/compare-*` |

**AC16 cannot be met in this change and is not pretended to be.** It asks for a live run of the same
question against both agents, recorded as a dated fixture, with the observed differences written
into `docs/harness-comparison.md`. That needs a run against the live service and §5 forbids
hand-writing a recording to stand in for one. (**Amended 2026-09-20:** the credential was there all
along — a shadowed `az` binary, see `docs/REFERENCES.md`. AC16 is not blocked on tooling; it is
blocked on two turns actually being run, which spends model tokens.) So
`docs/harness-comparison.md` gains the section with an explicit note that it is **unmeasured**, and
`docs/REFERENCES.md` gains the open item with what closes it: one comparison run. The spec ships at
`done` with AC16 named as outstanding, the same way spec 033's "does the agent write a valid chart
block" and spec 039's barge-in did.

## Risks / trade-offs

- **Two concurrent turns double the tool traffic**, including `search_web`, whose third-party rate
  limit is the one shared resource here (clarify Q6). Nothing in this plan mitigates it: the
  failure it produces is a tool returning `search_unavailable`, which the strip already renders as
  a failed lookup (spec 034 AC5). Inventing a queue would be the app deciding when an agent may
  call a tool, which is the §8 line.
- **App.tsx grows.** It is 704 lines and gains roughly 25: one hook, one branch in the view switch,
  and the trace surfaces reading the messages on screen instead of the chat's. The alternative — a
  second trace drawer inside `Compare` — trades size for drift, which is the worse trade.
- **`firstTokenAt` appears in the single-agent view too**, because `MetaLine` is shared and a
  mode-conditional figure would be two behaviours where one will do. It is additive: a turn that
  produced no text still renders nothing.
- **Two columns on a narrow screen** stack rather than shrink; a comparison squeezed into two 200px
  columns is unreadable. Stacking loses the side-by-side but keeps the figures, which is the part
  that does not fit in memory.
