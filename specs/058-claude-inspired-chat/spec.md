# Spec: Restrained, Claude-inspired chat

| | |
|---|---|
| **ID** | 058-claude-inspired-chat |
| **Status** | done |
| **Author** | Copilot App |
| **Date** | 2026-10-11 |

## Problem / motivation
The user asks: “acho que o UI ainda nao esta legal, deixe ele com a cara do Claude, mas nas cores atuais”. The current boxed role cards, crowded chrome and fragmented composer compete with the answer. A familiar, restrained conversational layout should make reading primary without losing observation or agent controls.

## Goals
- Quiet navigation and header, spacious centered reading, unboxed assistant prose.
- A softly distinguished user message and broad rounded integrated composer.
- Welcome centered on examples the selected agent actually declares.
- Progressive disclosure for reasoning/tools while observation stays discoverable.

## Non-goals
No copied branding, logos, proprietary assets or exact product text. No external fonts/tracking, palette changes, backend/contract/storage changes, ranking or inference. No repair or guarantee of hosted continuity.

## User-facing behavior
The same routes/actions remain accessible in a calmer shell. The answering agent and message role remain visible through quiet typography rather than heavyweight cards. Examples remain definition-sourced. Sending, stopping, multiline/IME input, errors, long tables/code, tools, traces, Events and comparison preserve their behavior. Existing bilingual labels and semantic light/dark palettes remain.

## Acceptance criteria
1. **AC1** — Desktop chat has restrained navigation/header, a centered reading column, largely unboxed assistant prose and a quietly distinguished user bubble; roles and agent identity remain accessible.
2. **AC2** — The composer is a broad rounded integrated surface with input/actions; multiline, IME, keyboard send and Stop behavior remain unchanged.
3. **AC3** — Welcome prioritizes actual agent examples; no invented prompts or capability description is introduced. Secondary reasoning/tool/meta surfaces disclose details without hiding their entry.
4. **AC4** — Existing Events/context/reset/locks, traces, navigation, comparison and error next actions remain discoverable and work by mouse/keyboard in EN/PT.
5. **AC5** — Light/dark and 320px/390px/desktop render without page overflow or offscreen essential controls, including long answers, tables/code, comparison and Events.
6. **AC6** — Before/after browser evidence uses credential-free real normalized replay; test doubles are not presented as service evidence. Existing palette tokens, vendored colors and contract/storage boundaries are unchanged.

## Contract / data impact
None. CSS is the visual source of truth; existing components, agent examples, strings and tokens remain their respective sources. No request or model decision is added.

## Open questions (clarify before planning)
None. The user-directed style and conservative limits were relayed by the coordinator; spec 058 is globally reserved. Design inspiration is layout, not branding replication. Spec 056 is retained, while spec 055's heavyweight cards are superseded visually.

## Out of scope / deferred
Service health, remote resets, hosted continuity investigation (#35 / #50), paid Azure/voice probes.
