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

## `ai/` hosted graph — the LangGraph container's tests (spec 018)

With the extra installed (`pip install -e ".[dev,hosted]"`), from `ai/`:

```bash
python -c "import langgraph, langchain_core, langchain_mcp_adapters"   # a missing extra fails here
pytest -q -rs tests/test_hosted_graph.py tests/test_hosted_host.py    # must report no skips
```

## `frontend/` — React + TypeScript + Vite

```bash
npm run lint
npm test
npm run build
npm run e2e   # Playwright smoke against the demo replay (own ports :8100/:5199)
```

First run on a machine: `npx playwright install chromium`. The smoke starts its own demo BFF
and Vite, so a running `just backend`/`just frontend` is not disturbed.

## security — dependencies and secrets (cross-layer)

```bash
pip-audit --skip-editable              # from the venv you develop in; local packages are skipped
cd frontend && npm audit --audit-level=high
gitleaks git --no-banner --redact .    # from the root; reviewed false positives in .gitleaksignore
```

A stale local venv can fail `pip-audit` while a fresh install passes — upgrade it (`pip install -U`)
rather than ignoring the finding.

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
