# Tasks: Project scaffold

> Chore-class change (see `plan.md` → *Test strategy*): no red→green cycle. Each task names the
> acceptance criterion it satisfies; AC11 is the closing gate.

## Tasks

- [x] **T1 — constitution (AC1)**: `.specify/constitution.md` with §1–§7 inherited, §8–§10 added,
      `infra/` gate as Bicep, amendment table recording the three deliberate divergences
- [x] **T2 — SDD workflow (AC2)**: `specs/_template/` copied verbatim; `specs/README.md` with the
      workflow and a status index covering 000–006
- [x] **T3 — agent guidance (AC3)**: `CLAUDE.md` + `AGENTS.md` written as twins — same commands,
      same architecture summary, same §8/§9/§10 invariants
- [x] **T4 — skills & subagents (AC4)**: `.claude/skills/{new-spec,grilling,verify-gates}` +
      `.claude/agents/{code-reviewer,test-reviewer,docs-i18n-auditor}` and their `.codex/prompts/` twins
- [x] **T5 — CI (AC5)**: `ci.yml` with four layer jobs; `infra` job switched to `az bicep build`
      + `az bicep lint`; every job skips cleanly while its layer is empty; `release.yml` + GitHub
      templates + dependabot copied
- [x] **T6 — layer folders (AC6)**: `backend/ · ai/ · frontend/ · infra/` each with a `README.md`
      naming its contents and the spec that fills it
- [x] **T7 — READMEs (AC7)**: `README.md` + `README.pt-BR.md`, cross-linked, same content
- [x] **T8 — project files (AC8)**: MIT `LICENSE`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`
- [x] **T9 — config (AC9)**: `.env.example` with Foundry placeholders only; `.gitignore` excluding
      `.env`, `.azure/`, build output; `.editorconfig`
- [x] **T10 — task runner (AC10)**: `justfile` delegating to the canonical gate commands
- [x] **T11 — verify (AC11)**: run every layer gate; confirm green-by-skip on the empty repo
- [x] **T12 — docs (§4)**: `docs/development-workflow.md`; honest stubs for `docs/architecture.md`
      and `docs/harness-comparison.md` naming the spec that fills each

## Definition of done

- [x] Every acceptance criterion in `spec.md` is satisfied
- [x] Gates green (green-by-skip — no layer has code yet)
- [x] Docs updated in the same change; gate command set in sync across 4 files (§4)
- [x] `CLAUDE.md` ↔ `AGENTS.md` ↔ `.claude`/`.codex` in sync (§6)
- [x] README exists in en **and** pt (§7)
- [x] `spec.md` status updated to `done`
