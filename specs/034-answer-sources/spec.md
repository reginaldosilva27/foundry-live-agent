# Spec: Where an answer came from

| | |
|---|---|
| **ID** | 034-answer-sources |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |
| **Clarified** | 2026-09-19 |

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
lists them: the host and the path, enough to recognise the page. Identical URLs appear once,
attributed to the **first** call that produced them — the second call is not a second piece of
evidence about the same page, and a row that offered two destinations would be asking the reader to
pick without telling them what differs.

**Only once the turn settles.** The strip does not grow as calls land. A list that reflowed under a
streaming answer would move the text the reader is reading, and a source is only evidence once the
answer that used it exists.

**Each source names where it came from** — the Learn MCP server, or the web search tool — because
those are different kinds of evidence and the project's whole subject is the difference between a
call Foundry ran and a call this app ran.

**The project's own knowledge base counts, and is not a link.** `lookup_knowledge` returns passages
carrying a `source` — a path inside this repository, not a URL. Those are listed, named by that
path, and are not selectable as a link. Leaving them out would say the agent consulted nothing when
it consulted something; inventing a URL for them would be worse. The strip therefore has two kinds
of row, and says which is which.

**The reading rule is per tool, because the tools genuinely differ** — measured from the recordings,
not assumed:

| Tool | Where the URL is | Shape |
|---|---|---|
| `microsoft_learn` (MCP) | **`contentUrl`** | a string holding **two concatenated JSON documents**, `{"results":[…]}` then `{"structuredResponse":…}` |
| `search_web` (Tavily) | `url` | `{"query", "results":[{title, url, content}]}` |
| `lookup_knowledge` | none — `source`, a repository path | `{"query", "passages":[{text, source, score}]}` |

A generic URL scan over the output string — the tempting simplification — is wrong for all three.
It finds nothing at the top level of the Learn payload and instead pulls dozens of incidental links
out of the Markdown inside `content`, which would list pages the agent never consulted as though it
had. That is the §5 failure this spec is otherwise about.

**A voice turn gets the same strip.** Spec 007's replay builds the same `Turn` from the same
events, so this costs nothing and lands exactly where spec 017 wanted the URLs to go — on the
screen, never in the audio.

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
9. **AC9** — A URL that appears in two different calls renders once, attributed to the first call
   that produced it.
10. **AC10** — The strip renders only once the turn has settled; a streaming turn shows none.
11. **AC11** — A `lookup_knowledge` passage renders as a source named by its repository path, and
    is not rendered as a link.
12. **AC12** — The Learn MCP payload's two concatenated JSON documents are both read, and URLs are
    taken from `contentUrl` — never scraped out of `content`.
13. **AC13** — Every new string ships `en` + `pt`.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). Everything needed is in `mcp_call` and `tool_result` today. |
| **Extraction rule** | One home: `frontend/src/state/sources.ts`. It has to live in the frontend because the shapes arrive as the `output` **string** on events the §9 contract already carries, and reading them in the BFF would mean changing that contract for a rendering concern. What keeps it honest is that its tests are driven by the **recorded** tool outputs in `ai/tests/fixtures/recorded/` — the real payloads, not hand-written ones (§5), so a shape that changes upstream fails here rather than silently listing nothing. |
| **Export** | `exportTurn.ts` grows a section; the exported shape is the same one spec 027's conversation export will carry. |
| **Docs** | `docs/how-it-works/` — the two kinds of call, now visible in the chat rather than only the panel. |

## Out of scope / deferred

- Fetching titles, favicons or previews.
- Inline citation markers in the answer text.
- Any assertion about which source supports which claim.
