# Spec: Every turn knows what day it is

| | |
|---|---|
| **ID** | 067-current-moment |
| **Status** | in-progress |
| **Author** | Reginaldo Silva |
| **Date** | 2026-11-14 |

> Fill the WHAT and the WHY. **No implementation detail here** — that belongs in
> `plan.md`. If you catch yourself naming a file or a function, move it to the plan.

## Problem / motivation

On 2026-11-14, about two hours after Brazil played Japan, the owner asked the agent — by voice —
*"quanto foi o jogo do Brasil?"*. The trace shows what happened:

- The agent did **not** ask for the date. It searched `resultado do último jogo do Brasil futebol
  seleção brasileira` — no date, no opponent.
- The top result was a stale results table listing *"ter., 18 nov. — Brasil 1-1 Tunísia"*, with
  **no year**. Those games were in 2025. The agent, which does not know it is 2026, reported them
  as the most recent.
- The one result that described the real game (*"Japão x Brasil … neste sábado, às 7h15"*) was
  unreadable as "today" to an agent that did not know today was Saturday.

The agent definition already says *"never guess the time or the date"* and offers a tool for it.
The model searched anyway without calling it: an instruction that depends on the model noticing
what it does not know is conditioned on the thing it cannot see. Nothing dynamic reaches the model
today — the instructions are static, and a turn carries only the person's message.

Measured the same day against the live service, with the date stated beside the question: the agent
answered *"que dia é hoje?"* with no tool call, and the same match question searched
`resultado do jogo do Brasil hoje futebol 14 novembro 2026` and identified the real game.

## Goals

- The model knows the current date, time and timezone on every turn, text and voice, without having
  to decide to ask for it.
- What it is told is a **fact about the world**, stated by the app's clock, in a timezone the
  deployment declares — never an instruction, never anything about the person.
- Both harnesses receive the same fact, and the hosted agent keeps its own instructions when it
  does.
- The constitution says, in so many words, that this is allowed and why.

## Non-goals

- **The browser's timezone or locale.** Either would add a field to `POST /chat` and start sending
  this browser's facts to the server. The deployment declares one timezone for everyone.
- **Anything beyond date, time and timezone.** The list is closed (see the amendment). Language,
  location, the person's name — none of it.
- **Changing the agent's instructions.** Verified unnecessary: with the fact present, the agent uses
  it unprompted. `get_current_datetime` stays for other timezones and for a long voice call.
- **Finding a score the search index does not have yet.** Two hours after the match, a dated query
  found the game but not the final score. That is the search provider's freshness, not this spec.
- **Showing the timezone on the About screen.** Possible later; not needed for the behaviour.

## User-facing behavior

No screen changes. The person notices only that the agent knows what day it is: *"que dia é hoje?"*
is answered without a tool call, and a question about "today's game" searches for today's date.
No new user-facing strings (§7: n/a).

## Acceptance criteria

1. **AC1** — Given any text turn on the prompt agent, when it is sent to Foundry, then its input is
   one item stating the current moment followed by the person's message, unchanged.
2. **AC2** — The stated moment is the server clock read in the deployment's declared timezone, which
   defaults to `America/Sao_Paulo`: at `2026-11-15T01:30Z` it states Saturday, 14 November 2026,
   22:30, `America/Sao_Paulo`, `UTC-03:00`.
3. **AC3** — Given a declared timezone the system does not recognise, the app refuses to start,
   naming the setting — it does not fail on the first turn.
4. **AC4** — The stated moment is one sentence of fact: it names no tool, gives no instruction, and
   carries nothing the person or the model said.
5. **AC5** — When a turn makes a tool round trip, the leg that answers the call carries only the
   tool outputs — the moment is stated once per turn, not once per leg.
6. **AC6** — Given a hosted-agent turn that arrives with the moment item, the hosted agent still
   applies its own instructions, ahead of everything else.
7. **AC7** — A voice session states the moment once, when it opens, beside the spoken-conversation
   item — two context items, and no more.
8. **AC8** — `POST /chat` still takes exactly `message · conversation_id · agent`; nothing about the
   time travels from the browser.
9. **AC9** — *(live, recorded, not CI)* Against the applied agent, *"que dia é hoje?"* is answered
   with no tool call, and a question about today's match searches with today's date in the query.

## Contract / data impact

- **Constitution §8** gains a second bounded exception, with a closed list, in the same change.
  Every document that says the exception is "single" or "spent" is reconciled (§6: `CLAUDE.md` ↔
  `AGENTS.md`, the READMEs, the voice lifecycle doc).
- **New configuration**: the deployment's timezone, with a default and a placeholder in the env
  example.
- **No change** to `POST /chat`, `GET /config`, the `AgentEvent` set (§9) or the agent definition.
- The hosted agent's container changes and must be redeployed **before** a BFF that sends the item
  serves hosted turns, or those turns lose their instructions.

## Open questions (clarify before planning)

- [x] *Which facts?* Date, time and timezone only — the owner, 2026-11-14.
- [x] *Whose timezone?* Declared by the deployment, default `America/Sao_Paulo` — the owner,
  2026-11-14.
- [x] *Does Foundry accept a non-user item beside `agent_reference`?* Yes — a `developer` message,
  observed 2026-11-14 (see `docs/REFERENCES.md`).

## Open — a consequence measured after implementation

The first example question in the agent definition, *"What time is it in Sao Paulo right now?"*,
exists to demonstrate a function tool the **app** executes. With the moment stated, the agent
answers it from context — measured 2026-11-14, en and pt, **no tool call** — while *"What time is
it in Tokyo?"* still calls `get_current_datetime`. The README's message-journey GIFs show the São
Paulo round trip. The owner decides: move the example to another city, or accept that it no longer
shows the tool.

## Out of scope / deferred

- Return the search date and each result's published date from `search_web`, so an undated result
  reads as possibly old — a separate, complementary fix (the 2026-11-14 analysis).
- A per-person timezone, if the app ever has identities.
