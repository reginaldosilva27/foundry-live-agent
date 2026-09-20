# /verify-gates

> Twin of [`.claude/skills/verify-gates/SKILL.md`](../../.claude/skills/verify-gates/SKILL.md) —
> keep them in sync (constitution §6). Mirrors `.github/workflows/ci.yml` plus the cross-cutting
> constitution gates.

Run the project's definition of done and report what passes/fails. **Do not declare anything done
while a gate is red** — paste the failing output instead.

Run each layer's gates from its own folder. A layer with no code yet **skips clean** — that is green,
not a failure.

## `backend/` — Python (FastAPI BFF)

```bash
ruff check .
ruff format --check .
pytest -q
```

## `ai/` — Python (harnesses, agent definitions, tools)

```bash
ruff check .
pytest -q
```

Integration tests that hit real Foundry are gated behind `RUN_INTEGRATION_TESTS=1` and skipped by
default (§5 — marked and skipped when unavailable, never faked).

## `frontend/` — React + TypeScript + Vite

```bash
npm run lint
npm test
npm run build
```

## `infra/` — Bicep + azd

> **Bicep, not Terraform** — the constitution was amended on purpose; see its *Amendment process* table.

```bash
az bicep build --file main.bicep
az bicep lint --file main.bicep
```

**`infra/` is empty today** — there is no `main.bicep`, so this layer **skips**: `ci.yml` and the
`gate-infra` recipe both guard the pair with `[ -f main.bicep ]`. A skip here is green (§3); an
error saying the file is missing means the guard drifted.

## Cross-cutting gates

- **§1 SDD** — a spec exists under `specs/`, at least `planned`.
- **§2 TDD** — a failing test drove the change.
- **§4 one source of truth** — contract/schema/config changes moved their mirrors and docs in the same change.
- **§6 agent sync** — `CLAUDE.md` ↔ `AGENTS.md` ↔ `.claude`/`.codex` moved together.
- **§7 bilingual** — new user-facing strings exist in `en` **and** `pt`; `README.md` ↔ `README.pt-BR.md`.
- **§8 agent-loop boundary** — nothing in `backend/` or `frontend/` chose which tool to call,
  re-prompted the model, looped on model output, or duplicated state Foundry owns. Executing a tool
  Foundry asked for is fine; deciding to call one is not.
- **§9 AgentEvent contract** — changes to `ai/harness/_shared/contract.py` came with a spec and moved
  consumers, fixtures and docs together.
- **§10 cite the doc** — every new Foundry integration detail is recorded in `docs/REFERENCES.md`
  with its URL. Nothing written from memory.

## Reporting

A checklist with ✅/❌ per gate. On failure: name the gate, paste the output, propose the fix.
