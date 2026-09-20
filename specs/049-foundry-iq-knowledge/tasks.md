# Tasks: Foundry IQ as a knowledge source

> Red → green → refactor. Each implementation task is preceded by the test that fails first.
>
> **T0 is not a coding task and nothing below it can go green without it.** The tests can all be
> written and left red first — which is the right order anyway.

## Setup — manual, and the reason is in `plan.md`

- [ ] **T0 — provision, once** (§5: documented, not unverified Bicep). Each step's doc is in
      `docs/REFERENCES.md`:
  - [ ] a **Free** Azure AI Search service in the subscription holding the Foundry project
        (one per subscription; check none exists first — none did on 2026-09-20)
  - [ ] a **knowledge source** over the three files in `ai/harness/_shared/tools/knowledge/`
  - [ ] a **knowledge base** naming that source
  - [ ] **`Search Index Data Reader`** for the **BFF's** identity on the search service
  - [ ] **`Search Index Data Reader`** for the **hosted agent container's** managed identity
        (its `instance_identity.principal_id`, visible in `GET /agents/{name}`)
  - [ ] confirm the region serves agentic retrieval — the overview says "select regions" and does
        not list them inline; read `search-region-support` and record the answer (§10)

## Tests first

- [ ] **T1 — record, don't invent** (§5): capture one real `POST …/retrieve` response and one
      no-match response; redact with `ai/scripts/redact_fixture.py`.
- [ ] **T2 — failing test for AC1 · AC8**: `FoundryIqKnowledge.search` maps the recorded response
      onto `Passage`, and an empty response yields `passages: []` with no error.
- [ ] **T3 — failing test for AC5**: a 403 surfaces in the tool's result, and
      `LocalMarkdownKnowledge.search` is **patched and asserted not called**.
- [ ] **T4 — failing test for AC4**: both `agent.yaml` files, `SCHEMA` and the tool's registered
      name are unchanged — read from disk, not assumed.
- [ ] **T5 — failing test for AC3 · AC7**: unconfigured resolves to `LocalMarkdownKnowledge`;
      configured resolves to `FoundryIqKnowledge`; the container's tool list resolves to the same
      implementation the BFF gets.

## Implement

- [ ] **T6 — implement `FoundryIqKnowledge`** in `knowledge_tool.py`; make T2, T3 pass.
- [ ] **T7 — `_knowledge_source()` picks by configuration** in `registry.py`, following
      `_search_backend()`'s precedent; make T4, T5 pass.
- [ ] **T8 — settings + `GET /config`**, and `aboutFields.ts` in the **same** change or spec 032's
      drift test fails (AC9).
- [ ] **T9 — i18n**: the three `about.foundryIq*` keys in `en` and `pt` (AC11, §7).

## Prove it, rather than claim it

- [ ] **T10 — AC2 by construction**: assert `frontend/src/state/sources.ts` is **unchanged** and that
      `sourcesOf` renders a Foundry IQ turn identically to a local one, driven by the recorded
      payload.
- [ ] **T11 — AC6**: the adapter-parameterised contract suite passes **unedited**.
- [ ] **T12 — re-measure**: `compare_harnesses.py --probe round-trip` against both agents, and
      compare with the 2026-09-20 recordings. The retrieval sits inside the function-call round
      trip, so this is where a latency regression would show. Numbers into
      `docs/harness-comparison.md` with their date (§5).

## Docs, in the same change (§4)

- [ ] **T13**: `.env.example` (settings + the Free-tier caveats), `docs/architecture.md`,
      `ai/harness/README.md`, and the manual setup in `README.md` ↔ `README.pt-BR.md` (§7).
- [ ] **T14**: `docs/REFERENCES.md` — whatever the first real run taught that the doc did not say.

## Definition of done

- [ ] Every acceptance criterion in `spec.md` maps to a passing test, or is documentation (AC10,
      AC12) and is reviewed
- [ ] Lint clean · Tests green · `verify-gates` green
- [ ] The frontend diff for `sources.ts` is **empty**, and a test says so
- [ ] Docs updated in the same change; `GET /config` and `aboutFields.ts` in sync (§4)
- [ ] All new user-facing text exists in `en` **and** `pt` (§7)
- [ ] `spec.md` status updated to `done`
