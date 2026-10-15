# Spec: A light shell, a theme switch, and one Playground

| | |
|---|---|
| **ID** | 060-light-shell-and-playground |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-10-15 |
| **Clarified** | 2026-10-15 |

## Problem / motivation

The owner looked at the running app and said: *"esse frontend está meio feio, quero algo mais assim"*,
pointing at a light, airy workspace — a light rail with grouped sections, a blue primary pill for
"New conversation", a centred greeting over suggestion cards, a floating composer — and asked for the
same *style*, not a copy, **including a visible button to switch theme**.

Three surfaces were also called out as not earning their place:

- **Commands** (spec 025's palette) — "não faz sentido". A rail button and a key binding that open a
  second way to reach the same seven screens.
- **History** (spec 027's screen) — the rail already lists, groups and searches past conversations;
  a second screen for the same record is noise.
- **Compare** (spec 020) — a narrow tool. What a reader of a Foundry reference app expects is a
  **Playground** like the Foundry portal's: pick an agent, see its definition beside the chat, try
  it. Comparing two agents is one mode of that, and running one function tool (spec 042) is another.

Today the rail is the dark "deepest surface" in both themes (spec 036), so even the light theme reads
as a dark app, and the theme choice is buried in Preferences.

## Goals

- **Light is the default theme**; a reader who never chose sees the light app, whatever the OS
  says. `system` stays available in Preferences.
- The light theme reads as a light app: light rail, light canvas, white raised surfaces, the blue
  accent reserved for the primary action and the current item.
- A sun/moon control in the rail footer, beside EN/PT, switches theme in one press.
- The rail is: brand + collapse · **New conversation** · screens (**Chat**, **Agents**,
  **Playground**) · the answering agent (021) and Favourites (022), kept · conversations (search +
  grouped list) · footer (language, theme, connection).
- One **Playground** screen with two tabs — **Agent** and **Tools**.
- The empty chat greets and offers the answering agent's own examples as cards.

## Non-goals

- **No new palette values.** Colours still come only from the vendored
  `public/ds/colors_and_type.css` (spec 036); this spec remaps tokens, it does not invent colours.
- **No copied branding**, logo, product name or text from the reference screenshot.
- **No name in the greeting.** The app has no sign-in and knows nobody's name (§5).
- **No editing in the Playground.** Instructions, model and tools are shown **read-only**: Foundry
  rejects per-request parameters beside an `agent_reference` (`docs/REFERENCES.md`), and saving a
  definition is refused by §4 (spec 041). Spec 041's *proposal* flow stays where it is, on the agent
  detail screen, and the panel links to it.
- **No backend, contract, `AgentEvent` or `POST /chat` change.**
- **No replacement for History's export/import.** Removed by decision (see Clarifications).

## User-facing behavior

**Rail.** Light in the light theme, the deepest surface in the dark one. Order: brand and collapse
control; the **New conversation** pill; the three screens; the answering agent and Favourites,
unchanged in behaviour; a *Conversations* section whose header
carries the search; past conversations grouped by age; the footer with `EN | PT`, the theme switch
and the connection line. No Commands entry, no History entry, no Compare entry, no separate Tools
entry.

**Theme switch.** One button with a sun or moon icon. Pressing it sets the *opposite* of the theme
currently on screen (so from `system` it becomes an explicit choice). Its accessible name says what
pressing it does — "Switch to dark theme" / "Mudar para tema escuro" — and it is the same preference
Preferences writes (spec 036), so the two can never disagree. With nothing stored the theme is
**light** — before first paint too — and choosing `system` in Preferences still follows the OS.

**Empty chat.** A chip naming the answering agent, a greeting by time of day from this browser's
clock (*Good morning / Good afternoon / Good evening* · *Bom dia / Boa tarde / Boa noite*), one line
saying what the app is, and the agent's **declared** examples as cards (spec 037). An agent with no
examples shows no cards — never invented ones.

**Playground → Agent.** Left: the answering agent's definition as the agent detail screen reads it
(specs 030/031) — model, instructions, tools, reasoning, or a hosted agent's container — read-only,
with a link to its detail screen.
Right: a conversation with that agent, independent of the main chat and not added to the rail's
history. A **Compare with…** control adds a second agent and the conversation becomes two columns,
asked the same question (spec 020's behaviour, unchanged, including "no ranking").

**Playground → Tools.** Spec 042's tool runner, unchanged in behaviour, behind its own flag.

**Old addresses.** `/compare` opens the Playground's Agent tab; `/tools` opens its Tools tab;
`/history` opens Chat. A bookmark never lands on a blank screen.

Every new string ships `en` + `pt` (§7).

## Acceptance criteria

1. **AC1** — Given the light theme, the rail, the canvas and the composer resolve to light surface
   tokens and the rail's text to dark ink; given the dark theme, the rail is the deepest surface.
   Asserted on the stylesheet's token mapping, and contrast tests pass for both palettes.
2. **AC2** — The rail footer has a theme button whose accessible name names the theme it switches
   *to*; pressing it in light sets dark, in dark sets light, and from `system` sets the opposite of
   what the system resolves to. The choice persists through the same storage key Preferences uses,
   and Preferences reflects it. With nothing stored, the document carries `data-theme="light"`
   before React mounts and Preferences shows *Light*.
3. **AC3** — No "Commands" control renders anywhere, ⌘K/Ctrl+K opens nothing, and no other key
   binding or test references a palette.
4. **AC4** — No "History" nav entry and no History screen exist; the rail still lists, groups,
   searches and reopens past conversations exactly as before (spec 021/027 rail behaviour).
5. **AC5** — The rail's screens are exactly Chat, Agents and Playground, in that order, each with
   `aria-current="page"` when shown.
6. **AC6** — The Playground has two tabs (`role="tablist"`), Agent and Tools; Tools renders spec
   042's runner; with `playground.enabled` false the Tools tab says it is off rather than vanishing.
7. **AC7** — The Agent tab shows the answering agent's model, instructions and tools from the
   per-agent read the detail screen already makes (`GET /agents/{name}`, specs 030/031) — no new
   endpoint and **no** editable field; `null` and `""` instructions render differently (spec 030);
   a hosted agent shows its container instead.
8. **AC8** — A turn in the Agent tab posts `POST /chat` with exactly `message · conversation_id ·
   agent`, uses a conversation separate from the main chat, and adds nothing to the rail's history.
9. **AC9** — "Compare with…" adds a second column; one question posts twice, once per agent, with
   two independent conversations; nothing on screen ranks or scores the answers.
10. **AC10** — `/compare` → Playground Agent, `/tools` → Playground Tools, `/history` → Chat.
11. **AC11** — The empty chat shows the agent chip, a time-of-day greeting in the interface
    language for the browser clock's hour (05–11 morning, 12–17 afternoon, otherwise evening), and
    one card per declared example; pressing a card sends it. No examples → no cards.
12. **AC12** — Every new string exists in `en` and `pt`; `a11y.test.tsx` passes with the new
    screens (every control named); `layout.test.ts` passes (placement, breakpoint order); the app
    has no horizontal overflow at 320px, 390px and 1440px in both themes, checked in the browser
    with `just demo`.

## Contract / data impact

None on the wire. `POST /chat`, `GET /agents`, `GET /config` and the `AgentEvent` set are untouched.

Front-end sources of truth that move together (§4):

- **Routes** — `state/route.ts` remains the one definition of the address scheme; `history`,
  `compare` and `tools` stop being screens and become redirects.
- **Theme** — `state/preferences.ts` stays the one owner of the theme; the rail button and
  Preferences both write through it.
- **Tokens** — `styles/app.css` maps tokens; the vendored file is untouched.
- **Docs** — `CLAUDE.md`/`AGENTS.md` paragraphs that describe the palette (025), the History screen
  (027), Compare as a screen (020) and the rail as dark in both themes (036) move in the same change
  (§6); README screenshots that show removed screens are flagged for recapture.

## Clarifications (2026-10-15)

- **Playground shape** — Foundry-portal style: Agent tab (read-only definition + chat, compare as a
  mode) and Tools tab (spec 042). Editing parameters per request is not possible and not attempted.
- **History's export/import** — removed with the screen, not relocated.
- **Commands** — the whole palette goes, button and key binding.
- **Theme** — the owner picked *"Claro padrão"*: default **light**, `system` remains a choice in
  Preferences; the switch lives in the rail footer beside `EN | PT`.
- **Answering agent and Favourites** — kept in the rail; the request did not ask to remove them.

## Open questions (clarify before planning)

_None._

## Out of scope / deferred

- Re-adding export/import elsewhere (a later spec if it is missed).
- A "Projects"/"Workspace"/account block like the reference — this app has no such concepts.
- Editing an agent's definition from the Playground.
