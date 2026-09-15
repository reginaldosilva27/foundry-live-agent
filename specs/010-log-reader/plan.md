# Plan: The trace panel groups its calls, and opens one in a reader

> The HOW. Written after `spec.md` reached `clarified` on 2026-09-15.

## Approach

**The panel reuses the chat's row.** `ToolRow` already renders exactly the compact line this needs,
and it is already a button. The panel drops `ToolCard` and renders rows, which also means the two
surfaces cannot drift apart (§4). `ToolCard` stays where it still belongs: the voice overlay.

**The reader is a new component, `LogViewer`** — a centred modal over the app, built like the voice
overlay's scrim (the pattern and the tokens already exist). It renders the call's identity in the
header and two blocks: arguments, and result or error.

**Formatting is a pure function.** `formatPayload(text)` parses and re-indents JSON, and returns the
input untouched when it does not parse. Pure, so AC3 and AC4 are unit tests rather than DOM tests.

**Selection already exists.** `App` holds `{ turnId, callId }` from spec 009; the reader opens on
`callId` and clears it on close. A call pressed in the chat therefore opens the panel *and* the
reader, which is AC7 for free.

## Affected files

- `frontend/src/state/payload.ts` *(new)* — `formatPayload`; pure.
- `frontend/src/state/payload.test.ts` *(new)* — AC3, AC4.
- `frontend/src/components/LogViewer.tsx` *(new)* — the centred reader.
- `frontend/src/components/LogViewer.test.tsx` *(new)* — AC2, AC5, AC6.
- `frontend/src/panes/TraceDrawer.tsx` — rows instead of cards; opens the reader.
- `frontend/src/panes/TraceDrawer.test.tsx` — AC1, and the existing assertions move to rows.
- `frontend/src/App.tsx` — renders the reader for the selected call.
- `frontend/src/App.test.tsx` — AC7.
- `frontend/src/i18n/strings.ts` — three keys (below).
- `frontend/src/styles/app.css` — the reader; the panel's activity list.
- `docs/how-it-works/function-call-round-trip.md`, `CHANGELOG.md`, `specs/README.md`.

## Contract / data model changes (constitution §4)

None.

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `log.title` | `Call detail` | `Detalhe da chamada` |
| `log.close` | `Close the reader` | `Fechar o leitor` |
| `log.empty` | `This call returned nothing.` | `Esta chamada não retornou nada.` |

`tool.arguments`, `tool.result` and `tool.failed` are reused for the block headings.

## Test strategy (constitution §2 — TDD)

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 — rows only in the panel | no payload text in the drawer | `panes/TraceDrawer.test.tsx` |
| AC2 — the reader shows the call | arguments and result rendered | `components/LogViewer.test.tsx` |
| AC3 — JSON is indented | `formatPayload` over a JSON string | `state/payload.test.ts` |
| AC4 — non-JSON is untouched | `formatPayload` over prose | `state/payload.test.ts` |
| AC5 — a failed call | the error replaces the result | `components/LogViewer.test.tsx` |
| AC6 — Escape closes it | keydown on the document | `components/LogViewer.test.tsx` |
| AC7 — from the chat | press a chat row, reader opens | `App.test.tsx` |

## Risks / trade-offs

- A modal over a 320px drawer on a narrow screen: the reader is `min(900px, 100% - 2 × gutter)`, so
  it degrades to a full-width sheet rather than needing a second layout.
- `JSON.parse` on a 100KB payload runs on every render of the reader. It is one parse per open, not
  per keystroke; memoised anyway to keep re-renders cheap.
