# Plan: Tables and code you can take

> The HOW, written after `spec.md` reached `clarified` (2026-09-19).

## Approach

Two `react-markdown` component overrides beside spec 033's, and one pure module for the escaping.

**`pre` rather than `code`.** The controls need a wrapper around the block, and `<pre>` may contain
phrasing content only — a `<div>` inside it is invalid HTML. So `pre` becomes a `<figure>` holding
a header (language name, copy) and the `<pre><code>` react-markdown would have rendered. The `code`
override stays exactly as spec 033 left it.

**`table` gains a scrolling wrapper and a copy.** The TSV is read from the **rendered DOM** at copy
time, via a ref, because AC5 is about the table the reader is looking at — walking React children
would re-derive it and could disagree with what `remark-gfm` produced.

**Streaming is a context, not a prop drilled through.** Spec 033 already put an `OpenFence` context
in `Markdown.tsx`; this generalises it to one `BlockContext` carrying both `openFence` and
`settled`. `Conversation` already computes `isSettled(message.turn)` for the answer actions, so the
value has one origin.

**Alternative rejected:** building the TSV from the Markdown source text. It would need a table
parser this app does not have, and `remark-gfm`'s output is the thing on screen.

## Affected files

- `frontend/src/state/tsv.ts` (new) + test — the escaping rule, pure.
- `frontend/src/components/CodeBlock.tsx` (new) + test.
- `frontend/src/components/TableBlock.tsx` (new) + test.
- `frontend/src/components/Markdown.tsx` — `pre` and `table` overrides; `OpenFence` becomes
  `BlockContext`; a `settled` prop.
- `frontend/src/panes/Conversation.tsx` — pass `settled`.
- `frontend/src/i18n/strings.ts`, `frontend/src/styles/app.css`.

## Contract / data model changes (§4)

None on the wire. `useCopy` stays the one clipboard behaviour; both controls use it, so "copied"
means the same thing in five places now and is decided in one.

## i18n strings (§7)

| key | en | pt |
|---|---|---|
| `code.copy` | Copy this code | Copiar este código |
| `table.copy` | Copy this table | Copiar esta tabela |

`copy.copied` / `copy.failed` already exist and are reused (§4, AC4).

## Test strategy (§2 — TDD)

| AC | Test | File |
|---|---|---|
| AC1 | a fenced block names its language; an unfenced one names none | `CodeBlock.test.tsx` |
| AC2 | the control is a button with an accessible name | `CodeBlock.test.tsx` |
| AC3 | copying places exactly the code, no language line, no trailing newline | `CodeBlock.test.tsx` |
| AC4 | success and failure render the existing feedback | `CodeBlock.test.tsx` |
| AC5 | the TSV's rows and columns match the rendered table | `TableBlock.test.tsx` |
| AC6 | a cell with a tab, a quote and a newline round-trips | `tsv.test.ts` |
| AC7 | the wrapper scrolls; the conversation column does not | `TableBlock.test.tsx`, `layout.test.ts` |
| AC8/AC12 | a streaming turn renders no control, a settled one does | `Markdown.test.tsx` |
| AC9 | rendering and copying issue no request | `CodeBlock.test.tsx` |
| AC10 | both languages | `strings.test.ts` |
| AC11 | no control offers Markdown — asserted on the rendered controls | `TableBlock.test.tsx` |

## Risks / trade-offs

- **Reading the DOM at copy time** ties the TSV to the rendered table. That is the intent, and it
  means a future change to how cells render changes the copy with it — which is right.
- **`pre` override touches every code block in the app**, including spec 033's chart and diagram
  fences. Those return their own elements from the `code` override before `pre` ever wraps them, so
  the header must not appear on a drawn chart — tested.
