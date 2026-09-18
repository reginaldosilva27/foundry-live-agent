# Tasks: History you can search, and take with you

> The work, ordered, as a TDD checklist. Each implementation task is preceded by the
> test that should fail first (red → green → refactor). Check boxes as you go.

## Tasks

### The address (AC6, part)

- [x] **T1 — test**: `route.test.ts` — `/history` parses to `{ name: 'history' }` and builds back.
- [x] **T2 — implement**: `route.ts` — add the route to `Route`, `ROUTES`, `parseRoute`, `buildPath`.

### Matching, extracted once (§4)

- [x] **T3 — test**: `fold.test.ts` — folds case and accents (`conversacao` → `Conversação`).
- [x] **T4 — implement**: `state/fold.ts`; `palette.ts` imports it and drops its private copy.
      `palette.test.ts` must stay green untouched — that is the proof the move changed nothing.

### Search (AC1, AC2, AC3, AC5)

- [x] **T5 — test**: `history.test.ts` — `searchConversations` matches title, user text and agent
      text case-insensitively; an empty query returns the list unchanged and in order.
- [x] **T6 — implement**: `searchConversations` in `history.ts`, returning `{ conversation, fragment }`.
- [x] **T7 — test**: `history.test.ts` — matches a `ToolActivity.name` and an `McpActivity.serverLabel`;
      does **not** match a string that exists only in `arguments` or `output`.
- [x] **T8 — implement**: extend the haystack to tool and MCP names; carry the match's kind so the
      fragment can be labelled.
- [x] **T9 — test**: `HistoryList.test.tsx` — a matched row renders a fragment of the matched text,
      not only the title; an unmatched list renders as before.
- [x] **T10 — implement**: `HistoryList.tsx` takes results rather than conversations, renders the fragment.
- [x] **T11 — test**: `Sidebar.test.tsx` — the rail has a labelled search field above the list and a
      History nav item; typing narrows what the list shows.
- [x] **T12 — implement**: `Sidebar.tsx` — the field, the nav item, `View` gains `'history'`.

### The file (AC8, AC9, AC10, AC11, AC12)

- [x] **T13 — test**: `history.test.ts` — `toExportFile` carries `version`, `exportedAt` and every
      conversation with its messages, `conversationId`, agent and stored `turn.trace`.
- [x] **T14 — implement**: `RECORD_VERSION`, `ExportFile`, `toExportFile`.
- [x] **T15 — test**: `history.test.ts` — `parseExportFile` round-trips its own output; returns
      `null` for junk, for an unknown `version` and for a non-array payload.
- [x] **T16 — implement**: `parseExportFile`, reusing `isConversation`.
- [x] **T17 — test**: `history.test.ts` — `mergeImported` does not duplicate a stored `id`, keeps the
      newest past `CAP`, and reports `{ kept, dropped }`.
- [x] **T18 — implement**: `mergeImported`.
- [x] **T19 — test**: `history.test.ts` — `useHistory().clear()` empties the list **and** removes the
      stored key.
- [x] **T20 — implement**: `clear` on `useHistory`, through `storage.remove`.

### The documents (AC7)

- [x] **T21 — test**: `exportTurn.test.ts` — `conversationToMarkdown` renders every message in order,
      names the agent and carries the conversation's identifiers. Existing turn tests stay untouched.
- [x] **T22 — implement**: extract the turn body in `exportTurn.ts`; add `conversationToMarkdown`;
      extract `saveFile` into `state/download.ts` and point `AnswerActions.tsx` at it.

### The screen (AC6, AC11, AC12, AC13)

- [x] **T23 — test**: `HistoryScreen.test.tsx` — lists conversations with agent, date and turn count;
      a row's export control renders Markdown for that conversation; export-everything hands over
      one JSON file.
- [x] **T24 — implement**: `HistoryScreen.tsx` — list and the two export controls.
- [x] **T25 — test**: `HistoryScreen.test.tsx` — import reports kept and dropped; an invalid file
      leaves the record untouched and says so.
- [x] **T26 — implement**: the file input and the report.
- [x] **T27 — test**: `HistoryScreen.test.tsx` — clear asks first, naming the count and stating that
      Foundry's conversations are not deleted; cancel changes nothing; confirm empties the record.
- [x] **T28 — implement**: the inline confirmation.

### Wiring (AC4, AC6, AC9)

- [x] **T29 — test**: `App.history.test.tsx` — `/history` renders the screen; the palette lists
      `openHistory`; typing in the rail's field issues no `fetch`; importing a file and opening one
      of its conversations restores it with its stored `conversationId` and issues no `fetch`.
- [x] **T30 — implement**: `App.tsx` route→view, the query's owner, the handlers; `keys.ts` +
      `palette.ts` gain `openHistory`.

### Closing (AC14, §4, §7)

- [x] **T31 — i18n**: every new string in `strings.ts`, `en` + `pt` (`strings.test.ts` is the gate).
- [x] **T32 — styles**: `app.css` — the screen and the rail's field, matching the existing idiom.
- [x] **T33 — docs**: `docs/architecture.md` — what the browser keeps, what leaves it, what comes back.
- [x] **T34 — verify**: run the `verify-gates` skill; flip `spec.md` to `done`.

## Definition of done

- [x] Every acceptance criterion in `spec.md` maps to a passing test
- [x] Lint clean
- [x] Tests green
- [x] Type-check / build passes
- [x] Docs updated in the same change; cross-cutting contract in sync (§4)
- [x] (If bilingual) all new user-facing text exists in en **and** pt
- [x] `spec.md` status updated to `done`
