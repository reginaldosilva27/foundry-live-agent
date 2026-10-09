# Plan: Preferences that reach the application

## Approach

Derive App language from usePreferences, detecting only when lang is absent. Rail and
command-palette changes call that same store. Pass reasoningOpen through Conversation and Compare
to ActivityPanel and ReasoningCard. An undefined per-card override uses the preference;
a deliberate toggle stores the card override, never reset by stream updates.
Remove unsupported reading/activity toggles, retaining their stored fields and strings.
Do not mount speech, change Traces, or hide inline activity.

## Affected files

- App.tsx — shared language and reasoning preference consumers.
- Conversation.tsx, Compare.tsx, ActivityPanel.tsx, ReasoningCard.tsx — reasoning default.
- Preferences.tsx — remove unsupported controls.
- App.preferences.test.tsx and Preferences.test.tsx — integration and negative assertions.
- App.test.tsx — adjust old assertion that assumed always-open reasoning.
- specs/036-preferences-and-theme/spec.md and docs/design-system.md — reconciliation links.
- CHANGELOG.md — current behavior.

## Contract / data model changes

None. state/preferences.ts remains the source of truth; legacy fields survive unchanged.

## i18n strings

No new strings. Existing English/Portuguese keys remain compatible.

## Test strategy

| AC | Tests |
|---|---|
| AC1 | App language changes through Preferences and survives remount, both languages |
| AC2 | Rail and palette persistence; browser detection without stored choice |
| AC3 | Chat and comparison reasoning defaults; override survives stream updates and preference changes |
| AC4 | App has no activity checkbox; inline calls remain; Traces stays closed |
| AC5 | App/Preferences no reading checkbox; legacy true never calls speech and survives writes |
| AC6 | App choices work while storage setItem throws |

## Risks / trade-offs

A previously always-open reasoning card now follows the documented false default.
Legacy fields are inert, not authorization. Unsupported controls may return only after
an intentional future spec, not because their data survived.
