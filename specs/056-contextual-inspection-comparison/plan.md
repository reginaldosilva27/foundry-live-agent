# Plan: Contextual inspection and honest comparison

## Approach
Preserve PR #51 base e10586903d945567189e1aed7f6426828692b8ea. Compose existing inspector,
header and comparison hooks. Pass missing events through instead of coalescing to an array;
key inspector by turn so payload/filter cannot drift. Resolve agent from column identity.
Use useAgentStream.reset twice with either-stream guard. Guard first-agent selection centrally
while any comparison streams, even on another screen; disable shared selection controls.
After settling, first-agent changes clear left only, matching existing right semantics.
Readiness derives from current config/listing state, not a health probe.

## Affected files
- EventInspector.tsx, Header.tsx, App.tsx: context, navigation, visible entry, readiness.
- useComparison.ts, Compare.tsx: local pair reset and selection guards.
- Sidebar.tsx, Favourites.tsx, AgentsScreen.tsx, AgentDetail.tsx: visible selection locks.
- strings.ts, styles/app.css, ErrorCard.tsx: bilingual prose, responsive tokens, next actions.
- Tests, specs/README.md, docs/architecture.md: evidence and current behavior.

## Contract / data model changes
None: existing backend, AgentEvent and storage shapes unchanged. No remote delete/health request.
Local pair reset preserves chosen agents and unrelated single chat/history.

## i18n strings
Events context/unretained/no turn/filter; pair independence/reset/scope/locks;
loading/unavailable/idle status; manual failure next action. All ship en/pt in strings.ts.

## Test strategy
| AC | Test | File |
|---|---|---|
| AC1 | absent/captured/filter, restored turns, stale payload | EventInspector.test.tsx, App.observation.test.tsx |
| AC2 | mouse/keyboard entry, turn/agent navigation | App.observation.test.tsx |
| AC3 | reset pointers/messages, preserve chat/history/agents, independent requests | useComparison.test.tsx, Compare.test.tsx |
| AC4 | reset/selection locked, stop works, settled selection works | useComparison.test.tsx, Compare.test.tsx |
| AC5 | observable loading/failure/idle/streaming and next actions | App.observation.test.tsx, Compare.test.tsx |
| AC6 | EN/PT integration and replay browser keyboard/themes/320px | Above tests plus session browser evidence |

## Risks / trade-offs
Idle is not health. Hosted continuity remains unresolved (#35/#50), not guaranteed by local reset.
UI doubles are not service recordings. Browser replay uses existing labelled captured streams.
