# Plan: Compact build information

## Approach

Replace the shell banner with persistent header Replay + info controls. Reuse the existing demo
content/catalogue reader inside one build-info dialog; reuse useModalFocus for focus trapping and
restoration. Move sidebar technical facts into that dialog using existing strings and modelName.
Remove only header Voice wiring. Keep composer voice and all other routes unchanged.

## Affected files

- App/Header/Sidebar — move info entry and remove redundant chrome.
- DemoDetails/BuildInfo — existing recording details and accessible disclosure.
- app.css — token-only compact badge and fixed bounded dialog; remove obsolete banner styles.
- Related component/shell/layout tests — revised expectations and RED regression coverage.
- strings.ts, docs/architecture.md, README twins, specs index — explain disclosure.

## Contract / data model changes (constitution §4)

None. useDemo and BffConfig remain sources of truth. No disclosure fetch or storage.

## i18n strings (constitution §7)

| key / location | en | pt |
|---|---|---|
| buildInfo.title | Build information | Informações desta versão |
| buildInfo.close | Close build information | Fechar informações desta versão |

Reuse all existing model/gateway/transport/demo strings unchanged.

## Test strategy (constitution §2 — TDD)

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 | Closed chrome and persistent label across routes | App.shell/Sidebar tests |
| AC2 | Exact explanation, catalogue selection/unknown code | DemoDetails/BuildInfo tests |
| AC3 | Config variants, no extra request | BuildInfo/App.shell tests |
| AC4 | Keyboard open, focus trap, Escape/close restoration EN/PT | BuildInfo tests + browser |
| AC5 | Header vs composer voice and retained controls | App.shell tests |
| AC6 | Bounded fixed dialog and real browser geometry matrix | layout tests + browser |

## Risks / trade-offs

Details now require one action; persistent Replay keeps screenshots honest. Reuse focus behavior
rather than invent a second keyboard contract. Recording changes preserve the existing replay
selector semantics; no promise that recorded answers depend on a typed question.
