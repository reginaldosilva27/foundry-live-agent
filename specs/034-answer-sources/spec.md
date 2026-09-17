# Spec: Where an answer came from

| | |
|---|---|
| **ID** | 034-answer-sources |
| **Status** | draft |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

This agent is instructed to cite. `agent_core.yaml` tells it to name the Learn page it used and to
always cite the URLs `search_web` returns, and never to present a search result as its own knowledge.
It does. The result is a paragraph with bare links in it, which is the weakest possible rendering of
the strongest claim the app makes.

Meanwhile the app knows more than the text does. The `mcp_call` and `tool_result` events carry what
was asked and what came back — which server, which query, which pages. Spec 009 moved those payloads
into the trace panel, correctly, because they were drowning the chat. But that put the evidence and
the claim in different rooms: the answer says "according to the Learn docs" and the pages it actually
read are two clicks away in a panel most readers never open.

Spec 017 already established that a spoken answer must not read URLs aloud, which means the spoken
path needs the sources to live somewhere other than the sentence. This is that somewhere.

## Goals

- **A finished answer says what it consulted**, as a compact list under it.
- Each source is **traceable to the call that produced it** — one action from the source to the tool
  payload in the trace panel.
- The list is built from **events, not from parsing prose**.

## Non-goals

- **No inline footnote markers rewritten into the answer text.** We render what the model wrote; we
  do not edit its sentences (§5). The sources sit beside the answer, not inside it.
- **No fetching anything.** No page titles, no favicons, no previews — that would be the browser
  talking to the internet, and this browser talks to the BFF and nothing else.
- **No ranking, scoring or de-duplication by cleverness.** Identical URLs collapse; that is all.
- **No claim that a source supports a sentence.** We know what was consulted, not what was used. The
  wording must not imply otherwise.
- No change to the `AgentEvent` set (§9).

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**Under a finished turn** that made at least one call returning sources, a compact **Sources** strip
lists them: the host and the path, enough to recognise the page. Identical URLs appear once.

**Each source names where it came from** — the Learn MCP server, or the web search tool — because
those are different kinds of evidence and the project's whole subject is the difference between a
call Foundry ran and a call this app ran.

**Selecting a source opens the call** that produced it in the trace panel's reader (spec 010), where
the full payload already lives. The strip is an index into evidence the app already renders; it is
not a second copy of it (§4).

**A turn with no such calls has no strip** — not an empty one, not a heading over nothing.

**When a tool returned an error**, or `search_web` answered `search_unavailable`, the strip says the
lookup failed rather than listing nothing. A reader must be able to tell "it consulted nothing" from
"it tried and could not".

**Sources are exported** with the turn's Markdown (`exportTurn.ts`), because a saved answer without
its sources is the part of the answer worth least.

## Acceptance criteria

1. **AC1** — A finished turn with a source-returning call renders a Sources strip listing each
   distinct URL once.
2. **AC2** — Each source states which server or tool produced it.
3. **AC3** — Selecting a source opens the producing call in the trace panel's reader.
4. **AC4** — A turn with no source-returning calls renders no strip and no heading.
5. **AC5** — A call that errored renders as a failed lookup in the strip, distinct from having no
   sources.
6. **AC6** — The strip is built only from `mcp_call` and `tool_result` events; no code path extracts
   URLs from the answer text (asserted).
7. **AC7** — No request is issued as a result of rendering the strip (asserted).
8. **AC8** — The turn's Markdown export includes the sources.
9. **AC9** — A URL that appears in two different calls renders once and offers both calls, or
   renders the first — whichever the clarify step decides, and it is tested either way.
10. **AC10** — Every new string ships `en` + `pt`.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). Everything needed is in `mcp_call` and `tool_result` today. |
| **Extraction rule** | How a URL is found inside a tool output is new logic with one home. It differs per tool — the Learn MCP result and Tavily's result are shaped differently — so the plan names where that knowledge lives. If it needs to know a tool's output shape, that knowledge belongs beside the tool registry, not in a React component (§4). |
| **Export** | `exportTurn.ts` grows a section; the exported shape is the same one spec 027's conversation export will carry. |
| **Docs** | `docs/how-it-works/` — the two kinds of call, now visible in the chat rather than only the panel. |

## Open questions (clarify before planning)

- [ ] Is the extraction per-tool (a registry entry that knows how to read its own output), or one
      generic URL scan over the output string? The generic one is simpler and will be wrong for at
      least one tool.
- [ ] Do `lookup_knowledge` results — this repository's own knowledge base — count as sources? They
      have no URL, and saying "consulted the project knowledge base" may be worth as much.
- [ ] Does the strip render while streaming, as calls complete, or only when the turn settles?
- [ ] Does the voice path get a source list in the chat transcript (spec 007's replay), given spec
      017 deliberately kept URLs out of the audio?

## Out of scope / deferred

- Fetching titles, favicons or previews.
- Inline citation markers in the answer text.
- Any assertion about which source supports which claim.
