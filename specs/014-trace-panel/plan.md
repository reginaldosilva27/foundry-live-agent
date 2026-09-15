# Plan: The trace panel becomes an instrument

> The HOW for [`spec.md`](spec.md). Status of the spec when this was written: `clarified`.

## Approach

Everything this spec renders already exists in the frontend's state. The work is therefore
**presentation plus two small pieces of plumbing**, and no new data anywhere.

The two pieces of plumbing:

1. **Latency and model reach the panel.** Latency is `endedAt - startedAt` on the `AgentMessage`,
   which today only `Conversation` sees; the model comes from `GET /config`, which today only
   `Sidebar` and `Conversation` see. `App` already holds both, so it passes them down rather than
   anything recomputing them. `TraceDrawer` keeps taking a `Turn` and gains sibling props — it
   does not learn about `Message`, so it stays testable from a turn alone.
2. **Turn navigation needs the list.** `App` already derives `shownTurn` from `messages`; it also
   derives the agent turns' index and count and hands the panel two callbacks. The panel holds no
   list and no state of its own — it is told where it is and given a way to ask to move, which
   keeps the "no state the events did not put there" rule (§8) intact on this side.

Three new small components, because each is a distinct thing with its own test surface and the
alternative is one 200-line panel:

- **`CopyRow`** — label, monospace value, one press to copy; it also renders the *pending* case. Used for every id, so "copied"
  behaves identically everywhere and the clipboard is touched in exactly one place.
- **`TraceNumbers`** — the model/tokens/latency row, which omits what it does not have.
- The duration bar is **not** a component; it is a `<span>` inside `ToolRow` driven by a CSS custom
  property, because a component whose whole body is one styled span is a file for no reason.

**Alternatives considered.** A generic `<Trace>` context to avoid prop drilling: rejected, the
depth is two and the props are four. Rendering the bars with SVG: rejected, a div with a width
percentage is the same picture with none of the viewBox arithmetic.

**`ToolRow` becomes a grid**, and that is the one change that reaches outside the panel — the chat
and the voice overlay render the same component (§4), which is the point. The grid columns are
declared once; the bar row is a second grid row that collapses to nothing when there is no
duration, so the chat's rows do not get taller for calls that have no bar.

`navigator.clipboard` is absent in jsdom and on insecure origins. `CopyRow` treats the write as
something that can fail and reports failure in the row, which is also what makes AC1 testable.

## Affected files

- `frontend/src/panes/TraceDrawer.tsx` — head gains turn identity + arrows; ids become `CopyRow`s;
  numbers row added; the `Spans` section becomes a footer line.
- `frontend/src/components/CopyRow.tsx` — **new.** One id, copyable, with its own feedback state.
- `frontend/src/components/TraceNumbers.tsx` — **new.** Model, tokens, reasoning tokens, latency.
- `frontend/src/components/ToolRow.tsx` — fixed columns; optional duration bar driven by a
  `--bar` custom property; the bar's absence explained via `title` for MCP calls.
- ~~`frontend/src/panes/ActivityPanel.tsx`~~ — **unchanged, decided during implementation.** The
  plan had the chat's rows carry bars too. Spec 009 deliberately stripped the chat row down to one
  line of fact, and a bar under every call puts back the visual weight it removed. The bars live in
  the panel, which is the surface for comparing calls; `ToolRow` draws one only when it is given a
  ratio, so the chat and the voice overlay simply do not pass one.
- `frontend/src/App.tsx` — derives the shown turn's index/count, passes `model`, `latencyMs` and
  the two navigation callbacks to `TraceDrawer`.
- `frontend/src/components/Icon.tsx` — `CopyIcon`, and a left/right chevron reuse of `ChevronIcon`
  via CSS rotation (no second glyph).
- `frontend/src/i18n/strings.ts` — the strings below; `INTENTIONALLY_IDENTICAL` gains the two
  reserved id labels, which are wire tokens like the two already there.
- `frontend/src/styles/app.css` — the grid, the bar, the head, the numbers row, the copy row.
- `docs/how-it-works/tracing-and-gateway.md` — a line saying the panel now names the two reserved
  ids as pending, so the stub and the screen agree (§4).
- `CHANGELOG.md` — the entry.

## Contract / data model changes (constitution §4)

**None.** `ai/harness/_shared/contract.py` is not touched and no `AgentEvent` changes, so §9 is not
engaged and every harness is unaffected. `Turn` gains no field — `trace`, `usage` and
`activities[].durationMs` already carry everything rendered.

The single source of truth for "the two reserved ids belong to spec 005" is
`docs/how-it-works/tracing-and-gateway.md`; the panel's strings must not contradict it, and both
move in this change.

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `trace.turnPosition` | `turn {n} of {total}` | `turno {n} de {total}` |
| `trace.previousTurn` | `Previous turn` | `Turno anterior` |
| `trace.nextTurn` | `Next turn` | `Próximo turno` |
| `trace.copy` | `Copy` | `Copiar` |
| `trace.copied` | `copied` | `copiado` |
| `trace.copyFailed` | `could not copy` | `não foi possível copiar` |
| `trace.otelTraceId` | `otel trace id` | `otel trace id` |
| `trace.gatewayRequestId` | `gateway request id` | `gateway request id` |
| `trace.pendingTracing` | `arrives with the tracing spec` | `chega com a spec de tracing` |
| `trace.numbersTitle` | `Run` | `Execução` |
| `trace.spansFooter` | `Spans come from Application Insights, which the tracing spec adds.` | `Spans vêm do Application Insights, que a spec de tracing adiciona.` |
| `tool.noDuration` | `Foundry reports this call already finished, so it carries no duration.` | `O Foundry informa esta chamada já concluída, então ela não carrega duração.` |

`trace.otelTraceId` and `trace.gatewayRequestId` join `INTENTIONALLY_IDENTICAL` — they are field
names a reader greps for, like `trace.responseId` already in that list. `trace.spansTitle` leaves
the list only if the heading goes; it stays, because the footer keeps the word.

## Test strategy (constitution §2 — TDD)

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 | pressing a copy row writes the value and reports it; a rejected clipboard reports failure | `components/CopyRow.test.tsx` |
| AC2 | panel shows model, total tokens, reasoning tokens, latency | `panes/TraceDrawer.test.tsx` |
| AC3 | a turn with no usage omits the figures rather than rendering `0` | `components/TraceNumbers.test.tsx` |
| AC4 | panel states position; arrows call the callbacks | `panes/TraceDrawer.test.tsx` |
| AC5 | first/last turn disables the corresponding arrow | `panes/TraceDrawer.test.tsx` |
| AC6 | bar widths are proportional to the longest duration in the turn; longest is 100% | `components/ToolRow.test.tsx`, `panes/TraceDrawer.test.tsx` |
| AC7 | an MCP call renders no bar and carries the reason as text | `components/ToolRow.test.tsx` |
| AC8 | absent reserved ids render as pending; present ones render as copyable | `panes/TraceDrawer.test.tsx` |
| AC9 | the row declares fixed grid columns | `styles/layout.test.ts` |
| AC10 | the new controls are in the focus-ring selector list | `styles/layout.test.ts` (extends the existing list) |
| AC11 | every new key in `en` + `pt` | `i18n/strings.test.ts` (already generic — passes by construction) |
| AC12 | no bar without a `durationMs`; nothing rendered that is not on `Turn` | `components/ToolRow.test.tsx`, `panes/TraceDrawer.test.tsx` |

AC9 is read from the stylesheet rather than measured, which is the limitation `layout.test.ts`
already names: jsdom applies no stylesheet. The screenshot in `docs/assets/` is the evidence that a
browser painted it.

## Risks / trade-offs

- **`navigator.clipboard` is undefined in jsdom and on `http://` origins that are not localhost.**
  `CopyRow` must not throw when it is missing; the failure is a visible message, not a console
  error. The test asserts both paths.
- **The grid makes long tool names harder to truncate gracefully.** The name column takes the
  remaining space and wraps; a very long MCP tool name will make one row two lines high. Accepted:
  truncating the name hides the thing the row exists to say.
- **Relative bars invite a timeline reading.** Someone will see three bars and infer they ran in
  sequence at those offsets. Mitigated by giving them no shared axis, no gridlines and no start
  offsets, and by the footer that says where a real timeline comes from. This is the spec's most
  §5-sensitive decision and the reason the non-goals name it twice.
- **Turn navigation makes the panel's content depend on `App` state.** If a new turn streams while
  the reader is looking at turn 2, the panel must not jump. It follows `trace.turnId`, which is
  already how it works; the risk is a regression, and AC4 pins it.


## Implementation notes (2026-09-15)

- **`longestDuration` lives in `state/turn.ts`**, with the other pure derivations of the event log,
  so "measured" keeps one definition: an MCP call carries no duration and is not a zero-length one.
- **`layout.test.ts`'s token rule gained a clause.** `--bar` is set by React, so the stylesheet
  cannot define it; the rule is now that a property the stylesheet does not define must carry a
  fallback — `var(--bar, 0%)` — which is what distinguishes a runtime property from a typo. The
  typo it originally caught (`--dur-2`) would still fail.
- **No bars in the chat** — see the struck-through file above.
