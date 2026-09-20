# Plan: The contrast nobody guarded — the muted ink and the accent fill

> The HOW. Written after `spec.md` is `clarified`.

## Approach

**Two splits, no new colour.** Clarify settled both questions the same way — separate a token by the
*job* it does rather than move a value — so this change introduces no literal, edits no vendored
file, and changes no ramp step.

**The muted ink.** `--fg-4` is worn by 64 selectors doing two different jobs. Fifty-nine move to
`--fg-3`, which already clears 4.5:1 on every surface in both themes (5.69–7.44). Five keep `--fg-4`
and its 3:1 bar, which is what WCAG actually exempts:

```
.pill-button:disabled  ·  .composer__send:disabled  ·  .agent-detail__choose:disabled
.composer__input::placeholder  ·  .palette__entry[data-runnable='false']
```

**The accent fill.** A new semantic token, `--bg-accent-strong`, for the fill *that has text on it*,
resolving to `--ds-blue-700` — the only step in the blue ramp white passes on (5.90:1). It needs **no
dark override**: white is white and the step is the step, so one declaration serves both themes. The
ten decorative uses of `--ds-blue` — carets, pulsing dots, timeline bars, swatches — are untouched,
because they carry no text and WCAG 1.4.11 is this spec's declared non-goal.

**The guard that matters is not the ratio; it is the drift.** Sixty-four selectors accumulated on a
token exempted for five of them, one spec at a time, and no test could see it because the exemption
lived in a comment. So the new test is an **allowlist**: `--fg-4` may be worn only by selectors that
name a disabled or placeholder state, and a sixtieth content selector reaching for it fails CI. That
is the assertion this spec exists to leave behind — the ratios were already computable.

**Alternative rejected: raise `--fg-4`.** The ramp has no step between `--ds-n-500` and `--ds-n-600`
(light) or `--ds-n-400` and `--ds-n-500` (dark), so the raised token would be `--fg-3` spelled
differently. Two names for one value is the §4 problem, arrived at by a different road.

**Alternative rejected: change `--bg-accent`.** One line per theme and everything passes — but it
darkens the brand everywhere, including the ten places where the blue is only a colour, and in dark
it swaps a light blue for a dark one on a dark surface.

## Affected files

- `frontend/src/styles/app.css` — the 59 selectors move `--fg-4` → `--fg-3`; `--bg-accent-strong` is
  declared on `:root` and used by the ~9 text-bearing accent fills.
- `frontend/src/styles/contrast.test.ts` — the accent pair joins `PAIRS`; the `--fg-4` allowlist;
  the hierarchy and distinctness assertions.
- `specs/046-muted-ink-and-accent-fill/spec.md` — AC8's recorded sweep, with its date.
- `docs/design-system.md` — what this repository adds on top of what it imported, and why.
- `specs/README.md` — the index row.

## Contract / data model changes (constitution §4)

| | |
|---|---|
| **`AgentEvent` (§9)** | Unchanged. Nothing crosses the wire. |
| **The semantic layer** | `--bg-accent-strong` is declared in `app.css`'s `:root`, beside `--fg-harness` which spec 036's fix added for the same reason. One value, both themes, so there is deliberately **no** entry in either dark block — and `contrast.test.ts` reads `app.css`'s `:root` as part of the light mapping already, so the pair resolves. |
| **The vendored file** | **Untouched.** That was the point of both clarify answers. |
| **i18n (§7)** | Nothing. No new user-facing string, which is unusual enough here to be worth saying. |

## i18n strings (constitution §7)

n/a — no new prose.

## Test strategy (constitution §2 — TDD)

Everything lands in `contrast.test.ts`, which already resolves both palettes out of the two files.

| Acceptance criterion | Test |
|---|---|
| AC1 | the existing `PAIRS` cover `--fg-3` on every surface in both themes; the move makes them the pairs content is actually rendered in |
| AC2 | a new pair — white on `--bg-accent-strong` — checked in both themes like every other |
| AC3 | **the allowlist**: every selector in `app.css` wearing `var(--fg-4)` names a disabled or placeholder state |
| AC4 | the full `PAIRS` suite, unchanged, still green in both themes |
| AC5 | `--fg-3` and `--fg-4` resolve to different values in both themes |
| AC6 | `--fg-1`, `--fg-2`, `--fg-3` are three distinct values on every surface, both themes |
| AC7 | the existing "no colour literal in `app.css`" rule in `layout.test.ts` |
| AC8 | **not a test** — a browser sweep, recorded with its date in the spec (clarify Q4) |
| AC9 | n/a by construction: no brand colour changes, so nothing has to move with it |

## Risks / trade-offs

- **The ink hierarchy really does flatten**, from four weights to three for content. That is the
  cost clarify accepted, and it is visible: captions become the same ink as secondary text. The
  alternative was inventing a brand colour.
- **`--bg-accent-strong` is darker in dark mode than the fill beside it.** Non-text contrast is out
  of scope, so this spec does not measure the button against its surface — it is named here so the
  next person knows it was seen and deferred, not missed.
- **The allowlist will be tripped by legitimate additions.** A future disabled control must be added
  to it, which is a small tax; the alternative is the drift that produced this spec.
