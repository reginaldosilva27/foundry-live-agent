# Plan: The shell, elaborated

> The HOW for `spec.md` (status `clarified`). Frontend only: no Python file changes, no new
> endpoint, no `AgentEvent` touched.

## Approach

Four separable pieces, in dependency order. Each one is useful on its own, and none of them needs
the next to ship.

**1. The shell gets views and a rail.** `App` grows one piece of state — `view: 'chat' | 'agents'` —
and the sidebar grows a nav that sets it. That is the whole of the navigation: no router, no URL,
no history stack. A router would be four dependencies and a new failure mode for a two-item nav,
and the app has no addressable resources to name in a URL. Collapse is a second boolean, read from
and written to browser storage.

**2. The agents listing moves to the main column.** `AgentPicker` is split, not extended: the
sidebar keeps a single **answering agent** card, and the listing becomes `AgentsScreen` with a
search field and a grid of `AgentCard`. Its translation maps (`KIND_KEYS`, `STATUS_KEYS`,
`REASON_KEYS`, `ERROR_KEYS`) move with it unchanged — they are 019's honest half, and nothing in
this spec argues with them. `AgentPicker.tsx` goes away; its tests move to `AgentsScreen.test.tsx`
rather than being rewritten, so 019's criteria keep proving themselves on the new surface.

**3. The turn gains an action row.** `AnswerActions` sits above `MetaLine`. Copy goes through a
shared `useCopy` hook — extracted from `CopyRow`, which is today the app's only clipboard call and
says so; two callers means the hook, not a second implementation (§4). Download is a pure
`turnToMarkdown(question, turn, meta)` plus a six-line save, so the interesting half is testable
without a DOM.

**4. History.** One storage module owns the record shape and the cap; a hook wires it to `App`.
`useAgentStream` gains two things it lacks: it **exposes** the conversation id it already keeps in
a ref, and it accepts a `restore(messages, conversationId)`. Restoring is why the pointer matters —
without it, reopening would be a screenshot of a conversation Foundry would then refuse to
continue.

### The §8 argument for keeping a transcript

Storing the transcript is the one decision here that needs defending, because "duplicate state the
platform owns" is exactly what §8 forbids.

What we store is **not the conversation**. It is the frames the browser already received and
already drew, kept so the drawing survives a reload — a render cache, keyed by the id of the
conversation Foundry owns. Three properties keep it on the right side of the line, and each is an
acceptance criterion rather than a promise:

- **It never travels.** The request body stays `message · conversation_id · agent` (AC21).
  `ChatRequest` refuses history by construction, and this spec does not change it.
- **It is never read as truth.** Nothing derives a decision from it: no re-prompt, no replay into
  the model, no tool chosen from it. It is rendered and nothing else.
- **Foundry stays the owner.** Continuing a restored conversation sends Foundry *its own id* and
  lets it supply the context. If the two ever disagree, Foundry wins, because Foundry is the only
  one being asked.

The title is derived from the user's own first message for the same reason: asking a model to name
the thread would be this app running inference of its own, which is the thing §8 exists to stop.

## Affected files

**New**

- `frontend/src/state/storage.ts` — the safe-storage wrapper: `readJson` / `writeJson` / `remove`
  / `available`, every call in a `try/catch`. One place decides what a private window means (AC20).
- `frontend/src/state/history.ts` — the record type, the versioned key, and the pure operations:
  `titleFrom(message)`, `upsert(list, record, cap)`, `groupByAge(list, now)`. Plus `useHistory`,
  the hook that binds them to storage.
- `frontend/src/state/exportTurn.ts` — `turnToMarkdown()`. Pure.
- `frontend/src/hooks/useCopy.ts` — clipboard + the `idle → copied → failed → idle` state, lifted
  out of `CopyRow` verbatim.
- `frontend/src/components/Monogram.tsx` — initials from a name and a deterministic tint index.
  No image, no emoji: two letters on a brand tint (AC24).
- `frontend/src/components/AnswerActions.tsx` — copy · download · trace.
- `frontend/src/panes/AgentsScreen.tsx` + `AgentCard` — the main-column listing with search.
- `frontend/src/panes/HistoryList.tsx` — the grouped list, with rename and delete.
- `frontend/src/panes/AgentChip.tsx` — the composer's chip and its menu.
- Test files beside each of the above.

**Changed**

- `frontend/src/App.tsx` — `view` state; history wiring (save on `done`, restore on open); the
  blocked-continuation rule; passes the chip's props to `Composer`.
- `frontend/src/panes/Sidebar.tsx` — brand + collapse, nav, answering-agent card, history, footer.
  Loses the agent list (AC8) and the `sidebar.noHistory` note, which history replaces.
- `frontend/src/panes/Composer.tsx` — renders the chip slot; takes a `blocked` reason that disables
  the input and says why (AC18).
- `frontend/src/panes/Conversation.tsx` — `AnswerActions` on finished turns.
- `frontend/src/hooks/useAgentStream.ts` — expose `conversationId`; add `restore()`.
- `frontend/src/components/CopyRow.tsx` — uses `useCopy`; behaviour unchanged.
- `frontend/src/components/Icon.tsx` — `ChatIcon`, `AgentsIcon`, `PanelIcon`, `SearchIcon`,
  `DownloadIcon`, `TrashIcon`, `PencilIcon`, `ChevronDownIcon`.
- `frontend/src/i18n/strings.ts` — the table below.
- `frontend/src/styles/app.css` — the rail, the collapsed rail, cards, action row, chip, history.
  Tokens only; the "no hex" test already enforces that.
- `frontend/src/styles/layout.test.ts` — the shell's first column becomes a custom property so it
  can collapse; the assertion follows it, keeping its intent (three columns, capped at the
  viewport).
- `frontend/src/panes/AgentPicker.{tsx,test.tsx}` — removed; tests move to `AgentsScreen.test.tsx`.
- `frontend/src/App.test.tsx`, `App.voice.test.tsx` — follow the sidebar's new shape.

**Docs, in the same commit (§4, §6)**

- `docs/design-system.md` — retire **M9**; record the rail, the card grid, the action row and the
  chip as the layout contract.
- `docs/architecture.md` — one paragraph: the browser keeps a render cache and a conversation
  pointer; Foundry owns the conversation.
- `specs/README.md` — index row and the phase map.
- `CLAUDE.md` ↔ `AGENTS.md` — only if a rule changes. Nothing here changes a rule.

## Contract / data model changes (constitution §4)

No HTTP contract changes. One **new persisted shape**, whose single source of truth is
`frontend/src/state/history.ts`:

```ts
// localStorage key: `fla.history.v1`  — bump the suffix to invalidate, never migrate in place
interface StoredConversation {
  id: string                 // ours, for React keys and for rename/delete
  conversationId?: string    // FOUNDRY's — the pointer that makes resuming real
  agent: string | null       // null = the BFF's configured agent
  title: string              // derived from the first user message; never model-written (§8)
  updatedAt: number
  messages: Message[]        // the render cache; never sent anywhere (AC21)
}
```

`fla.ui.v1` holds the sidebar's collapsed flag — separate key, so clearing history does not reset
the chrome. Nothing server-side reads either one.

`HARNESS_FOR_KIND` stays the BFF's: cards render `selectable` / `reason` / `harness` exactly as
`GET /agents` gives them. No copy of that rule enters TypeScript.

## i18n strings (constitution §7)

| key | en | pt |
|---|---|---|
| `nav.chat` | Chat | Conversa |
| `nav.agents` | Agents | Agentes |
| `nav.collapse` | Collapse sidebar | Recolher barra lateral |
| `nav.expand` | Expand sidebar | Expandir barra lateral |
| `agents.searchLabel` | Search agents | Buscar agentes |
| `agents.noMatches` | No agent matches that. | Nenhum agente corresponde. |
| `agents.count` | {n} agents in this project | {n} agentes neste projeto |
| `agents.model` | model | modelo |
| `agents.answeringCard` | Answering | Respondendo |
| `agents.blocked` | The agent that held this conversation is not available. Start a new session to keep going. | O agente que conduziu esta conversa não está disponível. Inicie uma nova sessão para continuar. |
| `answer.copy` | Copy answer | Copiar resposta |
| `answer.download` | Download as Markdown | Baixar em Markdown |
| `answer.trace` | Open trace | Abrir rastro |
| `copy.copied` | copied | copiado |
| `copy.failed` | could not copy | não foi possível copiar |
| `composer.answeringWith` | Answering with {name} | Respondendo com {name} |
| `composer.chooseAgent` | Choose which agent answers | Escolher qual agente responde |
| `composer.allAgents` | See all agents | Ver todos os agentes |
| `history.title` | History | Histórico |
| `history.today` | Today | Hoje |
| `history.week` | Last 7 days | Últimos 7 dias |
| `history.older` | Older | Mais antigas |
| `history.empty` | Conversations you have will show up here. | As conversas que você tiver aparecem aqui. |
| `history.local` | Kept in this browser only — not the Foundry conversation store. | Guardado só neste navegador — não é o armazenamento de conversas do Foundry. |
| `history.unavailable` | This browser is not storing history. | Este navegador não está guardando histórico. |
| `history.rename` | Rename | Renomear |
| `history.delete` | Delete | Excluir |
| `history.untitled` | Untitled conversation | Conversa sem título |

`trace.copy` / `trace.copied` / `trace.copyFailed` collapse into `copy.*`: the same word, decided
once, now that two components copy things (§4). Retired: `sidebar.noHistory`.

## Test strategy (constitution §2 — TDD)

Every criterion below fails before the code that satisfies it exists. Unit where the logic is pure;
RTL where the behaviour is a user's.

| AC | Test | File |
|---|---|---|
| AC1 | nav renders Chat + Agents, one `aria-current`; activating each swaps the main column | `App.test.tsx` |
| AC2 | collapse toggles `data-collapsed`, items keep accessible names, flag is read back on remount | `panes/Sidebar.test.tsx` |
| AC3 | footer reports model/gateway/transport collapsed and expanded; config failure says so | `panes/Sidebar.test.tsx` |
| AC4 | a card per agent with monogram, name, kind, version·status, model, harness; unselectable is dimmed, inert, reasoned | `panes/AgentsScreen.test.tsx` |
| AC5 | typing narrows the grid; a query with no match renders the one line and no cards | `panes/AgentsScreen.test.tsx` |
| AC6 | activating a card selects, resets the conversation, returns to chat | `App.test.tsx` |
| AC7 | listing error renders the translated code plus the configured agent (moved from 019) | `panes/AgentsScreen.test.tsx` |
| AC8 | the sidebar renders the answering agent and no list | `panes/Sidebar.test.tsx` |
| AC9 | streaming turn has no action row; `done` turn has the three | `panes/Conversation.test.tsx` |
| AC10 | Copy writes the answer text and reports, then reverts | `components/AnswerActions.test.tsx` |
| AC11 | `turnToMarkdown` contains question, answer, each call, and the meta footer | `state/exportTurn.test.ts` |
| AC12 | Trace calls `onOpenTrace` with the turn | `panes/Conversation.test.tsx` |
| AC13 | an `error` turn renders Trace only | `panes/Conversation.test.tsx` |
| AC14 | chip names selected → configured → nothing | `panes/AgentChip.test.tsx` |
| AC15 | menu lists only selectable, choosing selects + resets, `Escape` closes and restores focus | `panes/AgentChip.test.tsx` |
| AC16 | on `done` a record is written with id/agent/title/timestamp/messages; grouping puts it right | `state/history.test.ts`, `App.test.tsx` |
| AC17 | reopening restores messages, and the next `fetch` body carries that `conversation_id` | `App.test.tsx`, `hooks/useAgentStream.test.tsx` |
| AC18 | a restored conversation whose agent is unselectable renders, blocks the composer, says why | `App.test.tsx` |
| AC19 | rename persists, delete removes from storage and list, New session removes nothing | `panes/HistoryList.test.tsx`, `state/history.test.ts` |
| AC20 | with storage throwing on read and write, the app renders and streams; the note appears | `state/storage.test.ts`, `App.test.tsx` |
| AC21 | a turn from a restored conversation posts exactly three fields | `hooks/useAgentStream.test.tsx` |
| AC22 | the 26th write drops the oldest | `state/history.test.ts` |
| AC23 | every new key exists in both languages; no prose in components | `i18n/strings.test.ts` (existing) |
| AC24 | monogram is letters + tint, no emoji anywhere in `src` | `brand.test.ts` (existing, extended), `components/Monogram.test.tsx` |
| AC25 | history region and agents grid each declare their own scroll with `min-height: 0` | `styles/layout.test.ts` |

AC25 is a stylesheet assertion, with the same limitation `layout.test.ts` already documents: jsdom
paints nothing, so it proves the rule is declared. The browser check is a screenshot at 1280 and
1440, taken by hand before the spec closes.

## Risks / trade-offs

- **The restored pointer can be stale.** A Foundry conversation that was deleted, or a project that
  was rebuilt, makes the next turn fail. It fails *loudly* — the BFF's error reaches the stream and
  the turn renders it — which is the honest outcome and needs no new machinery. Worth watching in
  practice before we add anything cleverer.
- **`localStorage` is synchronous and shared with nothing.** A 25-conversation cap keeps writes
  small; a quota failure is caught and degrades to AC20's no-history mode rather than losing a turn.
- **Removing `AgentPicker` touches 019's tests.** They move rather than being rewritten; if a moved
  test needs its assertions changed to pass, that is a behaviour change and belongs in this spec's
  criteria, not in a quiet edit.
- **Two boolean states in `App` instead of a router** means no deep-linking to the agents screen.
  Accepted: nothing here is addressable, and spec 020 will want the main column to hold two streams,
  which a URL scheme would have to be redesigned around anyway.
- **The chip duplicates a choice the agents screen also offers.** Two entry points, one rule —
  both call the same `select`, and 019's "switching starts a new conversation" holds for both.
