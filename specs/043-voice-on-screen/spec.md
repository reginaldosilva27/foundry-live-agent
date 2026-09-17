# Spec: Choosing the voice on the screen

| | |
|---|---|
| **ID** | 043-voice-on-screen |
| **Status** | draft |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-16 |

## Problem / motivation

Spec 012 configured the voice session — voice, turn detection, noise suppression — and declared a
non-goal by name: *no per-session choice in the UI; one configured voice per deployment.* That was
right for 012, whose job was to stop shipping service defaults, and the record of what followed is
the argument for revisiting it. The default voice changed three times in two days, each time after
somebody listened to it: multilingual Thalita, then Luana Flash for latency, then Thalita
DragonHD after the listening test 012 admitted it had not run.

Every one of those iterations required editing an environment variable and restarting the BFF, and
none of the alternatives could be heard back to back. For a repository whose Brazilian audience will
have opinions about which Portuguese voice sounds least like a robot, the comparison being impossible
in the product is a gap.

This spec revisits 012's non-goal deliberately, as the specs README prescribes: a new spec, not an
edit to a finished one.

## Goals

- **Choose the voice for a session** before starting it, from the ones the deployment offers.
- **Hear the difference** between two voices without a redeploy.
- Keep every existing constraint: no `instructions`, no per-session prompting, no second exception
  to §8.

## Non-goals

- **No `instructions` on the session.** Not supported with a custom agent, and §8's single bounded
  exception — one system context item stating the conversation is spoken (spec 017) — is spent and
  stays spent. This spec adds nothing to what the session says to the model.
- **No behaviour configuration.** How the agent behaves during a turn — including spec 016's spoken
  preamble — is changed in `agent.yaml` and applied, never per session and never by the BFF speaking
  for it. That sentence is in `CLAUDE.md` and this spec does not weaken it.
- **No custom or trained voices** (012's non-goal, unchanged).
- **No arbitrary voice name from the browser.** A free-text field would make the browser able to ask
  the service for anything; the deployment offers a list and the browser picks from it.
- No change to the `AgentEvent` set (§9).

## User-facing behavior

All new prose ships `{ en, pt }` (§7).

**The choice is made before the session starts**, where the voice control is: which voice, from a
short list the deployment declares, with the deployment's default preselected. A session already
running is not reconfigured.

**The list is the deployment's**, not the browser's and not the service's full catalogue. A
deployment that declares one voice shows no chooser at all — which is every deployment that has not
opted in, so the default experience is exactly what spec 012 shipped.

**The choice is this browser's preference** (spec 036's storage) and persists. It is not a change to
the deployment and the screen says so, the same way history and favourites do.

**What each voice is** is named honestly: its identifier and its tier, as declared. No adjectives we
have not measured — "natural", "expressive" — because we have not measured them (§5).

**Turn detection and noise suppression stay deployment configuration.** They change behaviour in ways
a reader cannot evaluate in one session, and 012's reasoning for them is unchanged. Only the voice
moves to the screen.

## Acceptance criteria

1. **AC1** — With more than one voice declared, the voice control offers the choice before a session
   starts, defaulting to the deployment's default.
2. **AC2** — With one voice declared, no chooser renders and the session behaves exactly as today.
3. **AC3** — The chosen voice is sent with the session's configuration and the session speaks in it.
4. **AC4** — The choice persists in this browser and is preselected next time.
5. **AC5** — Changing the choice does not affect a session already running.
6. **AC6** — The browser cannot request a voice outside the declared list: an unknown value is
   refused by the BFF, not merely absent from the UI (asserted at the BFF).
7. **AC7** — No `instructions` field and no additional context item is sent with the session
   (asserted — the §8 guard, extending spec 017's test).
8. **AC8** — Turn detection and noise suppression are not settable from the browser (asserted).
9. **AC9** — The screen states the choice is local to this browser.
10. **AC10** — Every new string ships `en` + `pt`; voice identifiers are not translated.

## Contract / data impact

| | |
|---|---|
| **BFF / `AgentEvent`** | Unchanged (§9). |
| **`POST /voice/session`** | Gains an optional voice, validated against the declared list. The list is the BFF's (§4); the frontend holds no voice names. |
| **`GET /config`** | Carries the declared voices and the default, so the UI knows whether to offer a choice. |
| **Spec 012** | Its non-goal "no per-session choice in the UI" is revised by this spec for the voice only. 012 stays `done` and is not edited; this spec is the record of the change (specs README, append-only). |
| **Stored data** | Joins spec 036's preferences module rather than adding a key of its own (§4). |
| **§10** | Which voice identifiers are valid for `azure-standard` on this api-version comes from a doc read at the time of writing, recorded in `docs/REFERENCES.md`. |
| **Docs** | `docs/how-it-works/` — the Voice Live session lifecycle page. |

## Open questions (clarify before planning)

- [ ] Can the voice be changed mid-session with `session.update` — 012 noted it as the way a future
      "change the voice mid-call" would work — and is that worth building, or is before-start enough?
- [ ] Does the deployment declare voices explicitly, or does the BFF read a supported list from the
      service? Reading it is a §10 question first.
- [ ] Should the chooser offer a sample without starting a real session, and is there any way to do
      that without inventing an audio path this app does not have?
- [ ] Does spec 036 ship first, so this uses its preferences module rather than creating one?

## Out of scope / deferred

- Turn detection, VAD thresholds, noise suppression from the UI.
- Custom or trained voices.
- Anything that configures what the agent says.
