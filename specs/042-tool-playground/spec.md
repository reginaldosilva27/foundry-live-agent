# Spec: The tool playground

| | |
|---|---|
| **ID** | 042-tool-playground |
| **Status** | draft |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

The three function tools are where this project's central lesson lives. Foundry emits a function
call; **our BFF executes it**; the output goes back on the same conversation or the run hangs for ten
minutes and dies. `docs/how-it-works/` explains it, the activity panel shows it happening, and the
trace panel holds the payloads.

What nobody can do is run one. A reader who wants to understand `search_web` — what its arguments
look like, what its output looks like, what happens when Tavily is not configured and it answers
`search_unavailable` — has to phrase a question that persuades the model to call it, and hope. That
is a bad way to learn a tool and an actively bad way to debug one: when a tool misbehaves in a turn,
the only way to try again is to run another whole turn.

The §8 question deserves care, because "a screen that calls tools" is a description of the thing the
constitution forbids. The distinction is who chose. §8 forbids *the app* choosing which tool to call
— a loop, a heuristic, a re-prompt. A person typing arguments into a form and pressing run has
chosen, exactly as a person choosing which agent answers is configuration and not a loop (019). The
requirement that makes it safe is that this must be visibly **outside** the conversation: not a turn,
not in the transcript, not on any conversation Foundry knows about.

## Goals

- **Run one function tool with typed arguments**, and see exactly what it returns.
- **Read its schema** beside the form, because the schema is what Foundry is given.
- Make it **unmistakably not a conversation**.

## Non-goals

- **The app never chooses a tool.** No suggestion of which to run, no running one because a turn
  failed, no chaining one tool's output into another (§8).
- **No model involved.** Nothing here sends anything to a model, and the playground has no
  conversation and no `conversation_id`.
- **No MCP tools.** `microsoft_learn` is executed by Foundry, not by us; running it from here would
  be this app becoming an MCP client, which is a different architecture and a different spec.
- **No writing tools.** The three tools read. If a tool that changes something is ever added, it does
  not belong in a playground without its own argument.
- No change to the `AgentEvent` set (§9).

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**The playground** lists the function tools this build can execute, from the registry that is already
their single source of truth (§4) — the same names, descriptions and schemas Foundry is given.

**Selecting one** renders a form from its schema and the schema itself, side by side. What Foundry
sees and what the reader types are the same thing, visibly.

**Running it** executes the tool in the BFF process — the same execution path a real function call
takes, not a copy of it — and renders the output raw, with its duration, and copyable.

**A failure is rendered as the failure it was**: a tool that raised, a tool that returned
`search_unavailable` because no key is configured, a timeout. These are the interesting cases and the
screen must not smooth them into an error box that loses the actual output.

**It says what it is.** The screen states that this is not a conversation, that no agent was
involved, and that nothing here was sent to a model. Not as a disclaimer in small type — as the
framing of the screen.

**It is off unless enabled.** A public demo deployment should not necessarily expose a form that
executes `search_web` against a metered API key.

## Acceptance criteria

1. **AC1** — The playground lists exactly the function tools the registry defines, with their
   descriptions (§4) — no second list in frontend or backend source (asserted).
2. **AC2** — Selecting a tool renders its parameter schema and a form derived from it.
3. **AC3** — Running executes the tool through the same execution path used when answering a function
   call from Foundry (asserted, not by inspection).
4. **AC4** — The raw output renders with its duration and is copyable.
5. **AC5** — A tool that raises renders the failure; a tool returning `search_unavailable` renders
   that output verbatim, not as a generic error.
6. **AC6** — No `conversation_id` is created, sent or stored, and no model request is issued
   (asserted — the §8 guard).
7. **AC7** — Nothing run here appears in the chat transcript or in this browser's conversation
   record.
8. **AC8** — Arguments failing the schema are rejected before execution, with the validation failure
   shown.
9. **AC9** — With the playground disabled in configuration, neither the screen nor its endpoint is
   available, and the endpoint refuses (asserted at the BFF, not only hidden in the UI).
10. **AC10** — The screen states that no agent and no model were involved.
11. **AC11** — Every new string ships `en` + `pt`.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). The playground does not stream and emits no events. |
| **New endpoint** | Executes a named tool with given arguments. It must reuse `tool_executor`'s path, or it becomes a second implementation of tool execution — the §4 failure this project has avoided by implementing the tools once in `ai/harness/_shared/tools/`. |
| **`GET /config`** | Carries whether the playground is enabled, so the UI does not offer what the BFF will refuse. Disabled is the default. |
| **Security** | An enabled playground is an unauthenticated way to spend a third-party API key (`TAVILY_API_KEY`) and to make the BFF fetch arbitrary queries. `SECURITY.md` must say so, and the default must be off. |
| **Docs** | `docs/how-it-works/` — the function-call round trip page gains the place to try one. |

## Open questions (clarify before planning)

- [ ] Does the playground live behind the same switch as any future developer surfaces (spec 038's
      inspector), or its own?
- [ ] Is the form generated from the JSON schema, or is a raw JSON textarea both simpler and more
      honest about what Foundry actually sends?
- [ ] Does a run appear anywhere in tracing, and should it — a tool execution with no run to attach
      to may have nowhere to go.
- [ ] Should the playground show the *last real call* of that tool from this session as a starting
      point, or is that a convenience that blurs the "not a conversation" line?

## Out of scope / deferred

- Running MCP tools.
- Chaining or scripting tool calls.
- Any tool that writes.
