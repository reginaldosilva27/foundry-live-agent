# Tasks: Tables and code you can take

## Phase 1 — the escaping rule (AC6)

- [x] **T1 — test**: a cell with a tab, a newline or a quote is quoted with inner quotes doubled.
- [x] **T2 — implement**: `state/tsv.ts`.

## Phase 2 — the code block (AC1–AC4, AC9)

- [x] **T3 — test**: language name shown or absent; copy button named; copies exactly the content.
- [x] **T4 — implement**: `components/CodeBlock.tsx`.

## Phase 3 — the table (AC5, AC7, AC11)

- [x] **T5 — test**: the TSV matches the rendered rows and columns; the wrapper scrolls; no
      Markdown control exists.
- [x] **T6 — implement**: `components/TableBlock.tsx`.

## Phase 4 — streaming (AC8, AC12)

- [x] **T7 — test**: a streaming turn renders no controls; a settled one does; a drawn chart gains
      no code header.
- [x] **T8 — implement**: `BlockContext` and the `settled` prop through `Conversation`.

## Phase 5 — the record

- [x] **T9 — i18n**, **T10 — styles**, **T11 — layout test extended**, **T12 — refactor**.
- [x] **T13 — spec**: flip to `done`.

## Definition of done

- [x] Every acceptance criterion maps to a passing test
- [x] Lint clean · Tests green · `verify-gates` green
