# Plan: Where an answer came from

> The HOW, written after `spec.md` reached `clarified` (2026-09-19).

## Approach

One pure module and one small component.

**`state/sources.ts`** turns a settled `Turn` into `Source[]`. It is pure, so the recorded payloads
drive it directly, and it is the only place that knows a tool's output shape. Three readers, because
the three shapes are genuinely different — that is measured, not assumed, and the measurements are
in `spec.md`.

The Learn MCP reader is the one that needed looking at: its `output` is **not a JSON document**, it
is two of them concatenated (`{"results":[…]}{"structuredResponse":…}`). `JSON.parse` on the whole
string throws. So it decodes successively and reads `contentUrl` from each `results` entry. A
generic URL scan would find dozens of links inside the Markdown `content` and list pages the agent
never opened.

**`components/Sources.tsx`** renders the strip under a settled turn and calls the same
`onOpenTrace`-style handler `ToolRow` already uses to open `LogViewer`, so the strip is an index
into evidence the app already renders rather than a second copy of it (§4).

**Alternative rejected:** extracting sources in the BFF and putting them on the `tool_result` event.
Cleaner to consume, but it changes the §9 contract for a rendering concern, and it would make the
frontend's view of a call depend on the BFF's opinion of it. The events already carry the payload.

## Affected files

- `frontend/src/state/sources.ts` (new) — the readers, `sourcesOf(turn)`.
- `frontend/src/state/sources.test.ts` (new) — driven by the recorded payloads.
- `frontend/src/components/Sources.tsx` (new) + `.test.tsx` (new).
- `frontend/src/components/MessageBubble.tsx` — render the strip under a settled agent turn.
- `frontend/src/state/exportTurn.ts` + test — AC8.
- `frontend/src/i18n/strings.ts`, `frontend/src/styles/app.css`.
- `docs/how-it-works/charts-in-answers.md`'s sibling — a short section in
  `docs/how-it-works/streaming-events.md` on what the strip is built from.

## Contract / data model changes (§4)

`AgentEvent` unchanged (§9). One new internal type:

```ts
interface Source {
  kind: 'link' | 'passage'   // a URL, or a path in this repository
  label: string              // host + path, or the repository path
  url?: string               // absent for a passage — never invented
  from: string               // the server label or tool name (AC2)
  activity: Activity         // the call that produced it (AC3)
}
```

`kind` exists so the view never has to ask "is this a URL?" of a string. A passage has no `url` at
all rather than an empty one, which is the same absent-versus-empty rule the rest of the app uses.

## i18n strings (§7)

| key | en | pt |
|---|---|---|
| `sources.title` | Sources | Fontes |
| `sources.from` | from {tool} | de {tool} |
| `sources.knowledgeBase` | project knowledge base | base de conhecimento do projeto |
| `sources.failed` | this lookup failed | esta consulta falhou |
| `sources.openCall` | Open the call that produced this | Abrir a chamada que produziu isto |
| `export.sources` | Sources | Fontes |

## Test strategy (§2 — TDD)

| AC | Test | File |
|---|---|---|
| AC1 | a turn with a Learn call lists each distinct URL once | `sources.test.ts` |
| AC2 | each source carries its server label or tool name | `sources.test.ts` |
| AC3 | selecting a source calls the open-call handler with the producing activity | `Sources.test.tsx` |
| AC4 | a turn with no such calls yields `[]` and renders nothing | both |
| AC5 | an errored call yields a failed row, distinct from no sources | `sources.test.ts` |
| AC6 | `sources.ts` never reads `turn.text` — asserted on its source | `sources.test.ts` |
| AC7 | rendering issues no `fetch` | `Sources.test.tsx` |
| AC8 | the export carries the sources | `exportTurn.test.ts` |
| AC9 | the same URL from two calls appears once, bound to the first | `sources.test.ts` |
| AC10 | a streaming turn renders no strip | `Sources.test.tsx` |
| AC11 | a knowledge passage renders as a path and not as a link | both |
| AC12 | the **recorded** Learn payload yields its `contentUrl`s and no `content` links | `sources.test.ts` |
| AC13 | both languages | `strings.test.ts` |

**AC12 is the one that earns its keep.** It reads the real recorded payload out of
`ai/tests/fixtures/recorded/prompt-agent-turn-20260915.jsonl` and asserts both that the URLs come
out and that a link which appears only inside `content` does **not**. Hand-writing that fixture
would have hidden the two-documents problem entirely.

## Risks / trade-offs

- **Three readers keyed by tool name.** A fourth tool with no reader contributes no sources rather
  than failing — silent, but the alternative is a turn that will not render. The registry's names
  are stable and a test lists the ones covered.
- **The Learn payload's shape is not documented anywhere**, it is observed. If it changes, the test
  driven by the recording fails, which is the point of driving it from a recording.
