# Plan: Restrained, Claude-inspired chat

## Approach
Restyle the existing shell and chat, retaining components and handlers. Remove heavyweight card fills, use quiet role/agent typography, soften the user bubble, center the prose, and consolidate the composer visually. Keep actual examples as the welcome focus; existing reasoning/tool disclosure remains. Group header notices into a single grid slot so a notice cannot steal the scrolling content row. This is layout inspiration, not a copy of assets or branding.

## Affected files
- `frontend/src/styles/app.css` — shell, header, messages, composer, welcome and secondary surfaces; responsive rules.
- `frontend/src/App.tsx` — header/notice grid slot.
- `frontend/src/styles/layout.test.ts` and `chatPresentation.test.ts` — layout/design regressions.
- Existing conversation/composer/accessibility/observation/comparison tests — behavior preservation.
- `docs/architecture.md`, `specs/README.md` — updated visual boundary and spec status.

## Contract / data model changes (constitution §4)
None. Semantic palette and vendored design-system file unchanged. No new service API or data field.

## i18n strings (constitution §7)
Reuse existing bilingual labels; no new prose needed for a visual redesign.

## Test strategy (constitution §2)
| Acceptance criterion | Test | File |
|---|---|---|
| AC1 | Unboxed assistant, bubble and centered column style regressions; accessible roles | chatPresentation.test.ts / Conversation tests |
| AC2 | Integrated composer style regression; existing IME/send/stop tests | chatPresentation.test.ts / Composer tests |
| AC3 | Welcome example provenance and disclosure behavior | existing Welcome/Reasoning/ToolCall tests + browser |
| AC4 | Entry, context, lock, reset, independent requests, accessibility | App.observation/Compare/a11y tests |
| AC5 | Header notice slot regression, real viewport geometry with long content | layout.test.ts + Playwright replay |
| AC6 | Palette/no-contract diff review, real before/after replay screenshots | existing contrast/layout tests + browser artifacts |

## Risks / trade-offs
jsdom cannot measure layout: browser screenshots and overflow measurements complement source assertions. Existing spec 055 tests describing heavyweight cards must be updated to the new explicit user direction, without weakening role/identity checks. Replay has no hosted recording, so comparison checks use two independent prompt replay requests and never claim hosted continuity.
