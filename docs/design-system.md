# Design system and UI contract

The frontend is built on the **Dataside Design System**, and the screen layout comes from a Claude
Design project. This file records **where the design comes from** and **where it disagrees with what
we are actually building**. It is not a copy of the design system — that would fork the source of
truth (§4).

## Provenance

| | |
|---|---|
| **Design project** | `Foundry Live Agent Chat` — `claude.ai/design/p/ef299021-8157-4006-a1b1-1fb9586d0410` |
| **Screen** | `Foundry Live Agent.dc.html` (1440×900) |
| **Design system** | `dataside-design-system-1795979c-8cd4-4e79-80b5-99201daee465` |
| **Tokens** | `_ds/.../colors_and_type.css` — imported verbatim in spec 004 |
| **Read on** | 2026-09-04, via the `DesignSync` MCP |

Tokens are **imported, not retyped**. When the design changes, re-import; never hand-edit the copy.

## The mark is ours; the system is not

The **design system** is Dataside's — the tokens, the type, the rules below. The **brand mark** is
not: `frontend/public/icon-foundry-live-agent-{azul,branco}.svg` is this project's own, and it
replaced the Dataside icon that stood in for it while the UI was being built. A repository whose
argument is about Microsoft Foundry should not wear a consultancy's logo on its agent avatar.

It is built to the same rules as everything else here: one colour (`#0074FF`, or white on ink), no
gradient, no glyph, a 24×24 grid. A solid core inside a ring left deliberately open — the agent runs
in Foundry, and this repository is the app around it. It is checked at 12px (the turn avatar), 22px
(the sidebar) and as a favicon, because that is where it actually has to work.

## The brand rules that constrain us

From the design system's own README — these are not preferences, they are the brand:

- **Typeface: Poppins only.** Three weights: 300 Light, 400 Regular, 600 SemiBold.
- **The trademark heading move:** a Light headline with one or two **SemiBold** keywords inside it.
  The empty state uses it: *"Talk to your agent. **See everything.**"*
- **Palette is dramatically restricted:** `#0074FF` (Azul Dataside) and white carry almost
  everything; `#11151C` ink for dark surfaces; cool grays for everything else.
- **No gradients.** Where a soft surface is needed, use a blue tint, never a gradient.
- **No emoji. No Unicode glyph icons** (★, ▸, ✓) as decoration. Icons are SVG.
- **Radii:** 12px default card, 20px spotlight, 999px pill for buttons and chips.
- **Motion:** `cubic-bezier(0.22,1,0.36,1)` for entrances, 120/200/400 ms. No bounce, no overshoot.
- **Mono is for product/code contexts only** — and it is the OS monospace stack, not a webfont.

> The GitHub `README.md` uses emoji. That is a repository landing page, not the product surface, and
> is out of scope for the brand rule. **The application UI ships no emoji.**

## Layout contract (from the .dc.html)

Three columns, 1440×900 at the design width:

```
┌──────────────┬────────────────────────────────────┬──────────────┐
│ Sidebar      │ Header  60px                       │ Trace panel  │
│ 248px        ├────────────────────────────────────┤ 320px        │
│ --ds-ink     │ Chat scroll        --ds-n-50       │ --ds-ink     │
│ dark         │  (max-width 780px, centered)       │ dark, mono   │
│              ├────────────────────────────────────┤              │
│              │ Composer                           │              │
└──────────────┴────────────────────────────────────┴──────────────┘
```

**Sidebar** — brand mark, project name, version/licence in mono, primary "New session" button,
session list, and a mono status footer (endpoint · model · runtime dot).

**Header** — agent name, a `Microsoft Foundry` pill in `--ds-blue-100`, an animated status dot,
then `Voice` and `Traces` toggles as pill buttons. `Traces` is filled blue when the panel is open.

**Chat** — user messages are blue bubbles, right-aligned, `border-radius: 14px 14px 4px 14px`.
Agent turns render as a vertical stack under a 22px avatar:

| Block | Behaviour |
|---|---|
| Reasoning card | Collapsible, chevron rotates 90°, spinner while live, blinking caret at the tail, label becomes `reasoning · 1.2 s` when done |
| Tool card | Spinner → green check; name, args, then a result chip and duration; `running` pulses in blue |
| Answer text | Blinking blue caret while streaming |
| Meta line | `model · tokens · latency · view trace` in mono; *view trace* opens the panel |

**Composer** — bordered rounded input, mic button, blue send button (`scale(0.96)` on press).

**Voice overlay** — full-surface scrim `rgba(17,21,28,0.55)`, a 460px dark card, ten animated bars
(`vbar` 900 ms, staggered delays), live transcript in italic, `● listening · 00:14` in mono, and
`Mute` / `End session` pills.

**Trace panel** — mono throughout. Run id, `AGENT.RUN` status, span bars positioned by
`left: off/total%` and `width: len/total%`, a TOKENS row with large numerals, a metadata list, and an
"Open in Foundry portal →" link.

Four keyframes carry the whole thing: `caret`, `spin`, `vbar`, `pulse`.

## Where the design and the implementation disagree

> Numbered **M1–M9** (M for *mock*). Not to be confused with `PLAN.md` §8's **D-1–D-6**, which are
> deviations from the original brief. Two different tables; the earlier shared numbering was a
> mistake of mine.

The design is a **mock driven by a scripted scenario**, so some labels describe a system we are not
building. Spec 004 follows the design's *structure and visual language* and corrects these facts.
Listing them here so nobody "fixes" the code to match the mock.

| # | The mock says | We build | Why |
|---|---|---|---|
| M1 ✅ | `streaming via WSS`, `wss://…/agents/…` | **SSE over a POST** | Confirmed 2026-09-04. `EventSource` is GET-only and `/chat` is a POST. WebSocket is reserved for the Voice Live control channel. The footer and empty-state strings change to say SSE. |
| M2 ✅ | `gpt-4o` | **`foundry-analytics-demo/gpt-4o`** today | The mock turned out to be right: the gateway connection exposes only `gpt-4o`. The label stays, but gains the connection prefix. If a GPT-5.x model is exposed on the connection, this becomes `…/gpt-5.4` — and only then does the reasoning card have anything to show. |
| M3 ✅ | `eastus2` | `eastus` | That is where `foundry-analytics-demo` actually lives |
| M4 ✅ | `temperature 0.2` in the trace panel | **Removed** | Confirmed 2026-09-04. GPT-5.x reasoning models don't take `temperature`; showing it would teach something false. The row is dropped, not zeroed. |
| M5 ✅ | Tools `foundry.traces.query`, `databricks.jobs.get_run`, `github.releases.get` | `get_current_datetime`, `lookup_knowledge`, and the Learn MCP server | Those are Phase 4 ideas; the mock previews them |
| M6 ✅ | Every tool card looks alike | **App-executed and Foundry-executed tools look different** | Confirmed 2026-09-04. `executor` is the repo's central teaching point (§8): a tool the BFF ran and one Foundry ran are not the same event. A small mono tag (`bff` / `foundry`) sits on each card. |
| M7 ✅ | No MCP-specific treatment | `mcp_call` carries a `server_label` | An MCP call should be attributed to its server, not rendered as a generic tool |
| M8 ⏳ | Voice: `gpt-4o-realtime · WebRTC` | Voice Live attached to the **same agent**, over WebRTC | The point is one agent definition, two modalities — the label should say the agent, not a raw model |
| M9 ✅ | Session list with history | No persistence in Phase 1 | Either stub it honestly or drop it until there is somewhere to persist to (§5) |

M6 is the one that matters most. The mock renders every tool call identically, which is exactly the
distinction this repository exists to make visible.

> **Applied in spec 004.** ✅ means the correction is in the code. M3 and M5 resolved themselves:
> the UI renders whatever `GET /config` and the event stream say, so neither a region nor a tool
> name is written into a component. M8 (⏳) waits for spec 006.

## What was missing from the design

Not present in the mock, needed by the specs, and **built in spec 004**:

- **A harness badge** (`prompt-agent` / `langgraph`) — the surface that makes the swap visible to a
  viewer. It sits in the header pill area, as expected. Falls back to a labelled unknown state when
  the BFF is not answering, rather than claiming a harness.
- **Error rendering** — `ErrorCard`, with the code beside the message. The contract's whole point is
  that a failed run says so, and that guarantee is worth nothing if the UI renders it as nothing.
- **Bilingual strings** (§7) — `frontend/src/i18n/strings.ts`, with a test that every key has both
  languages and a second one that no component contains prose. A toggle in the sidebar switches.
- **Responsive behaviour** — below 1100px the trace panel becomes a fixed overlay; below 760px the
  sidebar drops out. Asserted as a CSS rule (jsdom applies no stylesheet), not as a measurement.
