# Plan: History you can search, and take with you

> The HOW. Written after `spec.md` is `clarified`. Decisions here must respect every
> principle in `.specify/constitution.md`; if one must bend, amend the constitution
> first and note it.

## Approach

Everything this spec needs is already in `localStorage` under `fla.history.v1`, so the whole feature
is **pure functions over `StoredConversation[]` plus one new screen**. No BFF endpoint, no new
`AgentEvent`, no fetch of any kind — which is what makes AC4 and AC9 testable as assertions about
`fetch` never being called.

Four decisions shape the work:

1. **`history.ts` owns the stored shape *and* the exported one.** The export file is the stored list
   verbatim under a `version` field, so there is exactly one shape to keep correct (§4). Import is
   `parse → validate → merge` over the same type. Nothing is stripped on the way out and nothing is
   invented on the way in.
2. **Matching is extracted, not duplicated.** `palette.ts` already folds case *and* accents so a
   reader typing `conversacao` finds `Conversação`; history search needs the same rule. `fold` moves
   to `state/fold.ts` and both import it — a second copy would be the §4 violation, and a
   history search that folded differently from the palette's would be a bug nobody could explain.
3. **One Markdown renderer, two documents.** `turnToMarkdown` already knows how to write a turn,
   including the executor distinction (design note M6) that this repo exists to make visible. The
   turn *body* is extracted into a helper; `turnToMarkdown` keeps its current output byte-for-byte
   (its tests are the proof) and `conversationToMarkdown` composes the same helper per turn under one
   heading. Likewise `saveFile`, today a private function in `AnswerActions.tsx`, becomes
   `state/download.ts` — three callers now, so it stops being single-use code.
4. **The screen, not the rail.** `/history` joins `route.ts` and `View` gains a third member. The
   rail gets only the search field; the three record-wide actions live where there is room to say
   what clearing destroys. Confirmation is **inline on the screen** — a second state of the clear
   control, not `window.confirm` (which blocks the page and is untestable in jsdom) and not a new
   modal component (nothing else in the app has one; building one here would be scope this spec
   did not ask for).

**Alternative rejected:** a `historyFile.ts` module separate from `history.ts`. It reads tidier but
splits one shape across two files, which is the drift §4 names. The export functions live beside the
type they serialise.

## Affected files

**New**

- `frontend/src/state/fold.ts` (+ test) — case/accent folding, extracted from `palette.ts`.
- `frontend/src/state/download.ts` — hand a generated file to the browser, extracted from
  `AnswerActions.tsx`.
- `frontend/src/panes/HistoryScreen.tsx` (+ test) — the search field, the full list with a per-row
  Markdown export, and the three record actions with inline confirmation and the import report.

**Changed**

- `frontend/src/state/history.ts` (+ test) — `matches()` / `searchConversations()` returning
  `{ conversation, fragment }`; `RECORD_VERSION` + `toExportFile()` / `parseExportFile()`;
  `mergeImported()`; `clear()` on `useHistory` (removes the key, not just the array).
- `frontend/src/state/route.ts` (+ test) — `{ name: 'history' }` ↔ `/history`.
- `frontend/src/state/palette.ts` — imports `fold`; `EXTRA_ACTIONS` gains `openHistory`.
- `frontend/src/state/keys.ts` — `Command` gains `openHistory` (no chord; the palette and the rail
  are its controls, which is what the table's comment already allows for `startVoice`).
- `frontend/src/state/exportTurn.ts` (+ test) — extract the turn body; add
  `conversationToMarkdown()`.
- `frontend/src/components/AnswerActions.tsx` — imports `saveFile` instead of defining it.
- `frontend/src/panes/Sidebar.tsx` (+ test) — `View` gains `'history'`; a nav item; the search field
  above `HistoryList`.
- `frontend/src/panes/HistoryList.tsx` (+ test) — takes the already-filtered results and renders a
  fragment under a matched title.
- `frontend/src/App.tsx` (+ `App.history.test.tsx`) — route → view, the search query's owner, and
  the export/import/clear handlers; the import report and the invalid-file message ride the existing
  `notice` prop rather than a new mechanism.
- `frontend/src/i18n/strings.ts` — the new strings, `en` + `pt`.
- `frontend/src/styles/app.css` — the screen and the rail's search field.
- `docs/architecture.md` — the browser's record now leaves and comes back; say what is in the file.

## Contract / data model changes (constitution §4)

| Contract | Single source of truth | Must move with it |
|---|---|---|
| Export file format | `history.ts` — `RECORD_VERSION`, `ExportFile`, `toExportFile`, `parseExportFile` | `docs/architecture.md`; `history.test.ts` round-trips it |
| Stored record | `history.ts` — `HISTORY_KEY = 'fla.history.v1'`, unchanged | nothing; no migration |
| Address scheme | `route.ts` — `Route`, `ROUTES`, `parseRoute`, `buildPath` | `Sidebar`'s `View`, `App`'s derivation |
| Commands | `keys.ts` — `Command`, `BINDINGS` | `palette.ts` `EXTRA_ACTIONS`, `App`'s dispatch |
| Text folding | `fold.ts` | `palette.ts`, `history.ts` |
| Markdown rendering | `exportTurn.ts` | `AnswerActions`, `HistoryScreen` |

`ExportFile` is `{ version: 1, exportedAt: number, conversations: StoredConversation[] }`. A file
whose `version` this build does not know is refused whole (AC12) — reading half of an unknown shape
is the kind of silent half-draw §5 rules out.

No BFF change. No `AgentEvent` change (§9). No new stored key.

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `history.search` | Search conversations | Buscar conversas |
| `history.searchEmpty` | No conversation matches | Nenhuma conversa corresponde |
| `history.matchTool` | tool | ferramenta |
| `history.matchServer` | MCP server | servidor MCP |
| `nav.history` | History | Histórico |
| `keys.openHistory` | Open history | Abrir histórico |
| `history.screenTitle` | History | Histórico |
| `history.screenNote` | {count} conversations this browser drew. The conversations themselves live in Foundry. | {count} conversas que este navegador desenhou. As conversas em si vivem no Foundry. |
| `history.turns` | turns | turnos |
| `history.exportOne` | Export as Markdown | Exportar como Markdown |
| `history.exportAll` | Export everything (.json) | Exportar tudo (.json) |
| `history.import` | Import a file… | Importar um arquivo… |
| `history.clear` | Clear the record | Limpar o registro |
| `history.clearConfirmTitle` | Delete the {count} conversations this browser kept? | Apagar as {count} conversas que este navegador guardou? |
| `history.clearConfirmBody` | This removes the drawings and the pointers stored here. The conversations in Foundry are **not** deleted. | Isso remove os desenhos e os ponteiros guardados aqui. As conversas no Foundry **não** são apagadas. |
| `history.clearCancel` | Cancel | Cancelar |
| `history.clearConfirm` | Delete | Apagar |
| `history.imported` | Imported {kept} conversations. | {kept} conversas importadas. |
| `history.importedDropped` | Imported {kept} conversations; {dropped} were dropped — this browser keeps {cap}. | {kept} conversas importadas; {dropped} foram descartadas — este navegador guarda {cap}. |
| `history.importInvalid` | That file is not a history export. Nothing was changed. | Esse arquivo não é uma exportação de histórico. Nada foi alterado. |

`strings.test.ts` already fails on a key missing a language or identical in both, so **AC14 is
covered by a test that exists** — no new test, but the gate is real.

## Test strategy (constitution §2 — TDD)

| AC | Test | File |
|---|---|---|
| AC1 | `searchConversations` filters by title and by either role's text, case-insensitively | `state/history.test.ts` |
| AC2 | a result carries a `fragment` of the matched text; the row renders it | `state/history.test.ts` · `panes/HistoryList.test.tsx` |
| AC3 | an empty query returns the list unfiltered, in order | `state/history.test.ts` |
| AC4 | typing in the rail's field with `fetch` stubbed issues no call | `App.history.test.tsx` |
| AC5 | matches a `ToolActivity.name` and an `McpActivity.serverLabel`; does **not** match a string present only in `arguments`/`output` | `state/history.test.ts` |
| AC6 | `/history` round-trips through `parseRoute`/`buildPath`; the address renders the screen; the palette lists `openHistory` | `state/route.test.ts` · `App.history.test.tsx` · `state/palette.test.ts` |
| AC7 | `conversationToMarkdown` contains every message in order, the agent and the ids | `state/exportTurn.test.ts` |
| AC8 | `toExportFile` carries `version`, and every conversation with messages, `conversationId`, agent and `turn.trace` | `state/history.test.ts` |
| AC9 | `parseExportFile(toExportFile(x))` equals `x` including `conversationId`; opening an imported conversation calls `restore` with that id and `fetch` is never called by the import | `state/history.test.ts` · `App.history.test.tsx` |
| AC10 | merging a file holding an already-stored `id` yields one, not two | `state/history.test.ts` |
| AC11 | merging past `CAP` keeps the newest by `updatedAt` and reports `{ kept, dropped }`; the screen says both numbers | `state/history.test.ts` · `panes/HistoryScreen.test.tsx` |
| AC12 | `parseExportFile` returns `null` for junk, for a wrong `version`, and for a non-array payload; the screen says so and the record is unchanged | `state/history.test.ts` · `panes/HistoryScreen.test.tsx` |
| AC13 | clear renders confirmation naming the count and the Foundry sentence; cancel leaves the list; confirm empties it and removes the key | `panes/HistoryScreen.test.tsx` · `state/history.test.ts` |
| AC14 | every key in `en` + `pt`, none identical | `i18n/strings.test.ts` (exists) |

Regression, not new behaviour: `exportTurn.test.ts` must stay green unchanged through the body
extraction — that is what proves the refactor was behaviour-preserving.

## Risks / trade-offs

- **The extractions touch files this spec is not about** (`palette.ts`, `AnswerActions.tsx`). Each is
  a move, not a rewrite, and each is forced by §4 rather than by taste. Existing tests are the guard.
- **Searching every message of 25 conversations on each keystroke** is a few thousand string
  comparisons against an in-memory array — below the threshold where debouncing would earn its
  complexity. If the cap ever rises, this is the line to revisit.
- **A large record may exceed the `localStorage` quota on import.** `writeJson` already returns
  `false` on a failed write and the rail already says the record will not survive a reload (021
  AC20); import inherits that path rather than inventing a second one.
- **Trusting an imported `conversation_id`** is a deliberate, spec'd choice: the failure is the
  existing turn-error card. Its cost is a reader who imports someone else's file from another tenant
  and learns it by sending a turn. The alternative was a fetch the app has no business making (§8).
