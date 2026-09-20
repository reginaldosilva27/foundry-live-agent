---
name: verify-gates
description: Run the full local mirror of CI (the project's "definition of done") and report what passes/fails. Use before declaring any change done, before opening a PR, or when the user asks to verify. Mirrors .github/workflows/ci.yml plus the cross-cutting constitution gates.
---

A change is **done** only when these are green (constitution §3 "Quality gates"; mirrors `.github/workflows/ci.yml`). Run them, then report a concise pass/fail summary — do not claim done if anything is red; paste the failing output.

> Run each layer's gates from its own folder. A layer with no code yet **skips clean** — that counts
> as green, not as a failure. Keep this file in lockstep with `.github/workflows/ci.yml`,
> `.codex/prompts/verify-gates.md`, the `justfile`, and the constitution's *Quality gates* (§4).

## `backend/` — Python (FastAPI BFF)

```bash
ruff check .            # lint
ruff format --check .   # formatting (use `ruff format .` to fix)
pytest -q               # tests
```

## `ai/` — Python (harnesses, agent definitions, tools)

```bash
ruff check .            # lint
pytest -q               # contract tests replay recorded fixtures — no Azure credential needed
```

Integration tests that hit real Foundry are gated behind `RUN_INTEGRATION_TESTS=1` and are skipped
by default (§5 — they are marked and skipped when unavailable, never faked).

## `frontend/` — React + TypeScript + Vite

```bash
npm run lint            # eslint
npm test                # component/unit tests
npm run build           # tsc --noEmit + bundler build (type errors are gate failures)
```

## `infra/` — Bicep + azd

> This project uses **Bicep, not Terraform** — the constitution was amended on purpose; see its
> *Amendment process* table.

```bash
az bicep build --file main.bicep   # compiles (syntax + type errors are gate failures)
az bicep lint --file main.bicep    # linter rules
```

**`infra/` is empty today** — there is no `main.bicep`, so this layer **skips**: `ci.yml` and the
`gate-infra` recipe both guard the pair with `[ -f main.bicep ]`. A skip here is green (§3); an
error saying the file is missing means the guard drifted.

## Cross-cutting gates (the ones tools won't fully catch)

Check these by inspecting the diff — they are constitution principles, not just CI steps:

- **§1 SDD** — the feature has a spec under `specs/` (and it's at least `planned`).
- **§2 TDD** — the change was driven by a test that failed first.
- **§4 one source of truth** — any contract/schema/config change moved its mirrors, types, and docs in the **same** change.
- **§6 agent sync** — if a rule changed, `CLAUDE.md` ↔ `AGENTS.md` and the `.claude`/`.codex` workflows moved together.
- **§7 bilingual** — every new user-facing string has both `en` and `pt`; `README.md` ↔ `README.pt-BR.md`.
- **§8 agent-loop boundary** — *the project-specific gate; check it on every backend/frontend diff.*
  Nothing in `backend/` or `frontend/` chose **which** tool to call, re-prompted the model, looped on
  model output, or duplicated state Foundry already owns. Executing a function tool Foundry asked
  for is fine; deciding to call one is not. Ask: *"would this still be true if the harness were
  swapped?"*
- **§9 AgentEvent contract** — any change to the event set in `ai/harness/_shared/contract.py` came
  with a spec and moved its consumers, fixtures and docs in the same change.
- **§10 cite the doc** — every new or changed Foundry integration detail (SDK version, endpoint,
  `api-version`, event name, RBAC role) is recorded in `docs/REFERENCES.md` with its URL. Nothing
  was written from memory.

## Reporting

Summarize as a checklist with ✅/❌ per gate. On failure: name the gate, paste the relevant output, and propose the fix — don't silently move on. If a formatting check fails, offer to run the formatter.
