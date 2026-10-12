# Spec: Corporate chat

| | |
|---|---|
| **ID** | 055-corporate-chat |
| **Status** | done |
| **Author** | Copilot App |
| **Date** | 2026-10-10 |

## Problem / motivation
The replay chat gives decorative pills, the question, activity and metadata similar visual weight.
A sober reading workspace should help a person distinguish their question from the agent's answer
without removing the reference implementation's inspectable evidence.

## Goals
- A restrained header, aligned reading column and composer, and clear message roles.
- Calm, readable examples and secondary telemetry in both themes and at narrow widths.

## Non-goals
Production readiness, Microsoft branding, new design-system dependencies, agent logic, new examples,
service calls, contracts, and redesigning unrelated screens.

## User-facing behavior
The same chat functions remain. Questions and answers gain visible bilingual role labels; the
answer label names the chosen agent when known. Examples remain exactly those declared by the agent.
The composer exposes its existing newline guidance visibly. The replay banner remains permanent.

## Acceptance criteria
1. **AC1** — User and agent messages have visible localized role labels; the agent label uses the supplied agent name and otherwise the localized role, including during streaming and errors.
2. **AC2** — At desktop widths the empty state is left-aligned with vertically arranged full-width examples, the question uses a neutral surface, and the answer remains primary prose rather than another coloured bubble.
3. **AC3** — The chat reading column and composer share a bounded width; the composer stays inset, displays the existing newline hint, and preserves Enter, Shift+Enter, IME, send/stop and voice semantics.
4. **AC4** — Chat header controls and activity use restrained rectangular treatments rather than pill/dashed decoration; reasoning, tools, sources, trace/event inspection and metadata remain available.
5. **AC5** — At 320, 390, 900 and 1440px, in light/dark, chat does not overflow the viewport; long code stays contained (wrapping or internal scrolling), and wide tables scroll inside their containers, and the mobile navigation remains usable. Comparison continues using the same message rendering.
6. **AC6** — Both palettes retain text contrast, visible keyboard focus and reduced-motion treatment; replay and request shape remain unchanged and no automatic or paid service calls are added.

## Contract / data impact
None. Existing public requests, events, storage, configuration and examples are unchanged. Styling
continues to consume the existing Dataside semantic tokens. New labels reuse the en/pt string table.

## Open questions (clarify before planning)
None. Coordinator explicitly resolved unavailable-user direction as conservative enterprise styling
with existing tokens, educational not production, and no new Fluent dependency or branding claim.
Baseline replay inspected before planning. Spec 054 is already published in sibling PR46, so 055
is reserved globally despite 053 being the highest folder in this explicit PR49 baseline.

## Out of scope / deferred
A live Foundry/voice validation is not required for visual refinement and would spend Azure resources.
