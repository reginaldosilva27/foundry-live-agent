# Chat visual refinement (spec 055)

The educational chat is a reading workspace, not a production-readiness or Microsoft branding
claim. It continues using Dataside semantic tokens; there is no new dependency.

## Hierarchy and interaction

- A neutral question card and visible localized role labels distinguish the question from prose.
  The answer names the supplied agent, or uses the localized agent role when none was supplied.
- The empty state uses a left-aligned headline and full-width example rows. Examples still come
  from the agent definition; this feature invents none.
- Reading and composing share a 780px maximum width. The composer is inset, its existing newline
  hint is visible, and its identity can shrink without pushing send/voice actions off-screen.
- Header and reasoning edges are restrained; reasoning, activity, sources, metadata, trace and
  event controls remain available. Comparison uses the same Conversation component.
- Enter, Shift+Enter, IME, send/stop, voice, focus and reduced-motion behavior remain unchanged.

## Verification — 2026-10-10

Credential-free Chromium inspection used the actual demo replay, preceded by light empty/settled
baseline captures. After captures cover light/dark at 320, 390, 900 and 1440px (height 900), empty,
streaming and settled turns. All eight theme/width pairs fit the document width. Four tool rows,
reasoning, call details and trace closure were exercised; replay events were also inspected.
Keyboard newline/send, streaming stop/disabled states and the local POST field allowlist were
checked. Agent chooser and comparison shell fit at 320, 390 and 1440px.

A real 320px composer overflow (333px document width) drove a failing shrink regression and was
fixed: document width is now 320px. Separate **test-only** browser render-cache probes covered
long prose, long code and wide tables in both themes at 320, 390 and 1440px. Code remained
contained (wrapped); tables scrolled inside their wrapper. A deliberately failed local transport
exercised the error card. Keyboard focus on the next control had a painted outline. These probes
are not Foundry recordings and establish no service behavior.

Frontend lint, 1082 tests and production build passed. Backend lint/format/299 tests and AI
lint/246 tests passed; three integration tests skipped. Infrastructure skips because main.bicep
is absent. Existing history-ref lint warnings and bundle-size warning remain unchanged.
The added bilingual role/hint tests and CSS guards passed; existing contrast, focus, mobile,
request-boundary and comparison tests also passed in the full suite.

Screenshots and probe scripts/results are session artifacts, not new shipped fixtures. No paid
Azure, live voice or live Foundry test was run. Screenshot inspection is not a comprehensive
screen-reader or cross-browser certification. Contracts, storage and agent logic are unchanged.
