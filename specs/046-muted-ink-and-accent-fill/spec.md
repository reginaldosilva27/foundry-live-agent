# Spec: The contrast nobody guarded — the muted ink and the accent fill

| | |
|---|---|
| **ID** | 046-muted-ink-and-accent-fill |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-20 |
| **Clarified** | 2026-09-20 |

## Problem / motivation

Spec 040 made the accessibility pass a test instead of a checklist, and `contrast.test.ts` has been
green ever since. It is green because of what it checks, not because the app passes — the sweep was
scoped to the **semantic text-on-surface pairs**, and two things sit outside that scope. Both were
found by measuring the rendered page in a browser rather than by reading tokens.

**One: the muted step is held to 3:1 on a premise that is no longer true.** The test exempts
`--fg-4` with a comment saying it "carries captions, placeholders and disabled text", and asserts
only 3:1 — WCAG's exemption is for *disabled controls*, and the comment quietly widens it to
captions. Sixty-four selectors wear `--fg-4` today. **Five** are genuinely disabled or placeholder
(`.pill-button:disabled`, `.composer__input::placeholder`, `.composer__send:disabled`,
`.agent-detail__choose:disabled`, `.palette__entry[data-runnable='false']`). The other **fifty-nine
carry content a reader is meant to read**: the meta line with a turn's tokens, latency and cost; the
Sources strip saying where an answer came from; the About panel's field names; the event inspector;
**a chart's axis labels**. A spec whose whole subject is that the app must not state things it
cannot support is rendering its measurements at 3.47:1.

**Two: text on the accent fill is not guarded at all.** No pair in the test puts text on
`--bg-accent`, so the one surface in the app that is a saturated colour has never been measured by
CI. It carries the send button, the monograms, the user's own message bubbles, the skip link, the
rail's active nav label and the language switch.

Measured from the tokens as they stand:

| | light | dark |
|---|---|---|
| `--fg-4` on `--bg-1` | **4.59** | **3.47** |
| `--fg-4` on `--bg-2` | **4.38** | **3.87** |
| `--fg-4` on `--bg-3` | **4.17** | **3.27** |
| white on the accent fill | **4.25** (`--ds-blue`) | **3.22** (`--ds-blue-500`) |

For contrast, `--fg-1` through `--fg-3` pass everywhere in both themes, from 5.69:1 up. The ramp is
not the problem; two decisions about it are.

This spec exists because neither fix is obvious and **both trade something a person should choose**.
Raising `--fg-4` compresses the ink hierarchy against `--fg-3`, which is what makes a caption read as
a caption. Darkening the accent fill changes the brand blue, in a **vendored** design-system file
this repository deliberately does not author (spec 036: colour literals live there and nowhere else).

Clarify resolved both by **splitting each token by the job it does** rather than by moving a colour —
which is why this spec adds no literal and leaves the vendored file alone.

## Goals

- **The bar a token is held to matches what that token actually carries**, and the reason is written
  where the exemption is claimed rather than assumed.
- **Text on the accent fill is measured by CI**, in both themes, like every other pair.
- **No regression**: every pair that passes today still passes, in both themes.
- The outcome is **measured, not asserted** — the numbers land in the test, and the claim the project
  makes about itself stays exactly as large as the measurement (§5).

## Non-goals

- **No conformance claim.** This project does not say "the app is AA". It says *these pairs, at these
  ratios, are asserted*, and that is all spec 040 ever claimed.
- **No redesign.** Nothing here changes a layout, a component or what any screen shows.
- **Not the rail, and not the surfaces already fixed.** The rail's ramp steps, `.main`'s surface and
  the inline code chip were bug fixes and are done; this is the part that needed a decision.
- **No new tokens for their own sake.** A token is added only if a real pair has no home.
- **Not non-text contrast** — borders, focus rings, icon-only affordances and chart series fills are
  a separate question with a separate WCAG rule (1.4.11), and folding them in here would make this
  spec unfinishable.
- No change to the `AgentEvent` set (§9), and no change to any BFF contract.

## User-facing behavior

Colours change; nothing else does. No new prose, so **no new strings** — §7 has nothing to carry
here, and that is worth stating because it is unusual for this repository.

**Text that a reader is meant to read becomes readable**, in both themes, at the bar its content
deserves. The visible change is small and concentrated in the quietest text on each screen: a turn's
meta line, the Sources strip, the About panel's labels, a chart's axis labels.

**Genuinely disabled and placeholder text stays quiet.** A disabled control that looks enabled is its
own defect, and WCAG exempts it for that reason. So the outcome is not "one token got lighter" — it
is that the two jobs currently sharing one token are told apart.

**The hierarchy survives.** Body, muted and quietest must remain visibly three different weights of
ink, or the fix has traded a measurable problem for an unmeasurable one.

## Acceptance criteria

1. **AC1** — Every semantic text token that carries **content** meets 4.5:1 against every semantic
   surface it is rendered on, in **both** themes, asserted.
2. **AC2** — Text rendered on the accent fill meets 4.5:1 in both themes, asserted by a pair in the
   same test as every other pair.
3. **AC3** — A token exempted below 4.5:1 is exempted **by name**, with the exemption's ground stated
   in the test, and only disabled or placeholder text may claim it.
4. **AC4** — Every pair that meets its bar today still meets it after this change, in both themes
   (no regression).
5. **AC5** — Content text and disabled text are distinguishable: the two do not resolve to the same
   colour on the same surface.
6. **AC6** — The ink hierarchy is preserved: body, muted and quietest text resolve to three distinct
   values on every surface, in both themes, asserted.
7. **AC7** — No colour literal is introduced outside the vendored design-system file (spec 036),
   asserted by the rule that already exists.
8. **AC8** — The rendered page is walked in a browser in both themes and the result is **recorded
   with its date** in the spec, as a measurement rather than as a claim (§5). It is deliberately not
   a CI test — see the clarified decisions.
9. **AC9** — If the brand's accent colour changes, every place that renders it moves in the same
   change, and the design-system provenance note says what was changed and why (§4).

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). Nothing here crosses the wire. |
| **The semantic layer** | `public/ds/colors_and_type.css` is the light mapping and the ramp; `app.css` holds the dark mapping. A token that changes must move in both, or a theme silently keeps the old value — which is the failure mode this repository has now hit twice. |
| **The vendored file** | Spec 036 made it the only place a colour literal may live, and this repository does not author it. If the accent fill must change, that rule is the thing being bent, and the spec must say so rather than editing quietly. `docs/design-system.md` records the provenance and has to move in the same change. |
| **i18n (§7)** | Nothing. No new user-facing string. |
| **Docs** | `docs/design-system.md` — what was changed against what was imported, and why. |

## Clarified decisions

Taken 2026-09-20 with the user. Q3, Q4 and Q5 were resolved by measuring the repository rather than
by asking, which is what the clarify step is for when a question has an answer already.

| # | Question | Decision |
|---|---|---|
| 1 | What bar does `--fg-4` answer to? | **Split it by job.** The ramp settles it: there is no step between `--ds-n-500` and `--ds-n-600` in light, or between `--ds-n-400` and `--ds-n-500` in dark, so raising `--fg-4` to clear 4.5:1 would make it *identical to `--fg-3`*. The fifty-nine content selectors move to `--fg-3`; `--fg-4` keeps its 3:1 bar and is worn only by the five that are genuinely disabled or placeholder. No colour is invented and the vendored file is untouched. |
| 2 | What happens to the accent fill? | **Split it by job too**, the same shape as (1). `--ds-blue` stays the decorative fill — carets, the pulsing dots, the timeline bars, the swatches: ten uses that carry no text and fall under WCAG 1.4.11, which this spec's non-goals exclude. A separate token carries the fill *that has text on it* and resolves to `--ds-blue-700` (**5.90:1** with white), the only step in the blue ramp that passes. About nine places move; the brand's blue is unchanged everywhere it is only a colour. |
| 3 | Is 4.5:1 the right bar, or do large-text pairs take 3:1? | **4.5:1 for everything, and no large-text allowance is introduced** — because after (1) and (2) nothing needs one. Content text lands at 5.69–7.44 and text on the accent fill at 5.90. An exemption nobody needs is a rule the next person has to reason about. |
| 4 | Does the browser sweep become a test? | **No — it stays a recorded, dated measurement.** Checked rather than assumed: `.github/workflows/ci.yml` installs Node and nothing else, and `frontend/package.json` carries no browser driver. Adding one so CI can assert what the token-level test already implies is a large dependency for one assertion, and it is the same trade spec 040 made for the same reason. The token pairs are the CI guard; the sweep is the evidence that the tokens describe the rendered page. |
| 5 | Does this spec touch the chart series palette? | **Only its axis labels**, which wear `--fg-4` today and are carried by (1) like every other piece of content. The series **fills** are non-text and stay out of scope — spec 033 validated them for colourblind separation and nothing here re-opens that. |

## The sweep, measured (AC8)

Walked in a real browser on **2026-09-20**, at 1440×900, on the chat with a settled turn — the
densest screen the app has: reasoning card, two tool rows, a Markdown table, the Sources strip, the
answer actions and the meta line. Every element carrying a text node, skipping what is visually
hidden and what is genuinely disabled, with SVG text read from `fill` rather than `color`.

| | before | after |
|---|---|---|
| below 3:1, light | 6 | **0** |
| below 3:1, dark | 8 | **0** |
| below 4.5:1, light | 9 | **0** |
| below 4.5:1, dark | 12 | **0** |

The *before* numbers are the state after the three bug fixes that preceded this spec, not the state
before them — those closed everything under 3:1; this spec closed the 3.22–4.38 band the bug fixes
deliberately left alone as a decision for a person to make.

**The sweep earned its place.** It found `--fg-link` at 4.06:1 on `--bg-2` — the `view trace` link,
a semantic text token carrying content that simply had no pair in the test. AC1 covered it in words;
nothing covered it in code until the browser said so. It is now three pairs like every other token.

It also found the trap in the scan itself: SVG text takes its colour from `fill`, so the first
version missed `.chart__axis-label` — a chart's axis labels, at 8px, the worst case in the sweep and
the example this spec opens on.

## Out of scope / deferred

- Non-text contrast (WCAG 1.4.11): borders, focus rings, the chart's own fills.
- **The chart's 8px axis labels.** Their contrast is fixed here; their *size* is not, and WCAG sets
  no minimum. 8px is small enough to be worth a decision, and it is a typography question rather
  than a colour one — noted here so it is deferred rather than missed.
- A conformance claim, or an audit against a level.
- The layout below 760px, which is its own gap and its own spec.
- Re-validating the chart palette, unless Q5 says otherwise.
