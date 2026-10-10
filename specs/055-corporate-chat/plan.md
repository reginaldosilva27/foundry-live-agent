# Plan: Corporate chat

## Approach
Keep the existing rendering/transport components. Add visible role labels and expose the existing
newline hint. Use semantic tokens for neutral question surfaces, rectangular scoped header controls,
left-aligned example rows, smaller heading, and a shared readable width. No dependency or backend
change. Scope header selectors so unrelated screens do not inherit control redesign.

## Affected files
- `frontend/src/panes/Conversation.tsx`, `components/MessageBubble.tsx` — role labels.
- `frontend/src/panes/Composer.tsx` — visible existing keyboard guidance.
- `frontend/src/styles/app.css` — bounded column, surfaces, spacing and scoped treatments.
- `frontend/src/panes/CorporateChat.test.tsx` — visible bilingual role/hint behavior.
- `frontend/src/styles/corporateChat.test.ts` — layout declarations (not painted geometry).
- `specs/README.md`, `docs/chat-design.md` — decision and verified browser evidence.

## Contract / data model changes (constitution §4)
None. Use `turn.you`, `turn.agent`, `composer.newline` from the existing string table. The same
Conversation still renders comparison. Preserve configuration, agent examples, events and requests.

## i18n strings (constitution §7)
No new strings. Existing English/Portuguese labels and newline hint are reused.

## Test strategy (constitution §2 — TDD)
| Acceptance criterion | Test | File |
|---|---|---|
| AC1 | Visible localized question/answer identity in streaming/done/error | CorporateChat.test.tsx |
| AC2 | Neutral question, bounded left-aligned examples declarations + real browser screenshots | corporateChat.test.ts |
| AC3 | Visible newline hint + existing composer Enter/Shift/IME/stop tests; shared width declaration | CorporateChat.test.tsx, Composer.test.tsx, corporateChat.test.ts |
| AC4 | Scoped header/secondary activity declaration + existing tool/source/trace/action tests | corporateChat.test.ts, existing frontend suite |
| AC5 | Real Playwright 320/390/900/1440 matrix, long code/table; existing comparison/layout tests | browser evidence, layout.test.ts, Compare tests |
| AC6 | Existing contrast/focus/reduced-motion/request/demo isolation tests plus keyboard browser | contrast.test.ts, layout.test.ts, App.routing.test.tsx, demo tests |

## Risks / trade-offs
CSS assertion tests prove declarations only; browser measurements/screenshots must prove layout.
No live-service claims. Baseline npm audit reports 8 dependency advisories; dependency remediation
is separate from this refinement. Synthetic long-text/error browser probes are labelled probes,
never presented as recorded service output.
