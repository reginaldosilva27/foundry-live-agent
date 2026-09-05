# Spec: Project scaffold — inherit the agentic-coding-template

| | |
|---|---|
| **ID** | 000-project-scaffold |
| **Status** | done |
| **Author** | Reginaldo Silva |
| **Date** | 2026-09-04 |

## Problem / motivation

`foundry-live-agent` is a public reference project and teaching material. Before any feature code
exists, the repository needs the same engineering discipline every other project of ours starts
from: a constitution, spec-driven development, per-layer quality gates, and agent guidance that
Claude Code and Codex both read.

Doing this **first** matters more than usual here. The repo's whole argument is that a boundary —
*the agent loop lives in Foundry, not in the app* — holds under pressure. A boundary that is only
described in prose erodes. Encoding it as constitution §8, with a review gate, is what keeps the
finished repo honest six months from now.

## Goals

- The inherited SDD + TDD workflow is live and runnable on an empty repository.
- The four architecture layers exist as folders with their gates wired into CI.
- One rule set, two front doors: `CLAUDE.md` and `AGENTS.md` say the same thing.
- The project's own invariants (§8 agent-loop boundary, §9 `AgentEvent` contract, §10 cite-the-doc)
  are law, not commentary.
- A contributor cloning the repo can run the gates and read where things go before any feature lands.

## Non-goals

- **No feature code.** No harness, no BFF, no frontend, no Bicep resources. Layer folders are
  created with a README that says what will live there and which spec fills it.
- No CI secrets, no Azure resources provisioned, no `git commit` or push.
- No design-system import (that is spec 004's dependency, blocked on `/design-login`).

## User-facing behavior

The "user" here is a contributor or a reader of the repo. They see:

- `README.md` with a language switcher to `README.pt-BR.md` (constitution §7).
- A visible map of the four layers and which spec fills each one.
- `just` recipes that run the same commands CI runs.

## Acceptance criteria

1. **AC1** — `.specify/constitution.md` exists with §1–§10 and lists the `infra/` gate as **Bicep**,
   not Terraform.
2. **AC2** — `specs/README.md` exists with the workflow and a status index listing specs 000–006;
   `specs/_template/` contains `spec.md`, `plan.md`, `tasks.md`.
3. **AC3** — `CLAUDE.md` and `AGENTS.md` both exist and state the same rules: SDD+TDD mandatory, the
   same per-layer commands, the same architecture summary, the same §8/§9/§10 invariants.
4. **AC4** — every `.claude/skills/<name>/SKILL.md` has a `.codex/prompts/<name>.md` twin, and every
   `.claude/agents/<name>.md` has a corresponding Codex review prompt.
5. **AC5** — `.github/workflows/ci.yml` has one job per layer (`backend`, `ai`, `frontend`, `infra`);
   the `infra` job runs **`az bicep build` + `az bicep lint`**; every job exits 0 with a skip notice
   while its layer has no manifest.
6. **AC6** — `backend/`, `ai/`, `frontend/`, `infra/` each exist with a `README.md` naming what lives
   there and which spec fills it.
7. **AC7** — `README.md` and `README.pt-BR.md` both exist, cross-link, and describe the same project.
8. **AC8** — `LICENSE` is MIT naming Reginaldo Silva; `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`
   exist.
9. **AC9** — `.env.example` contains only placeholders for the Foundry variables this project needs
   (project endpoint, agent name, model deployment, harness selector, Voice Live) and **no real
   secret**; `.gitignore` excludes `.env` and `.azure/`.
10. **AC10** — `justfile` recipes delegate to the exact commands in the constitution's gates and the
    `verify-gates` skill — the commands are not restated with different flags (§4).
11. **AC11** — running the `verify-gates` gates on this empty repo is green: every layer skips
    cleanly rather than failing.

## Contract / data impact

No runtime contract yet. This spec establishes two **process** contracts that later specs inherit:

- **The gate command set** — source of truth is `.specify/constitution.md` → *Quality gates*.
  `.github/workflows/ci.yml`, `.claude/skills/verify-gates/SKILL.md`, `.codex/prompts/verify-gates.md`
  and `justfile` all mirror it and must move together (§4, §6).
- **The layer map** — `backend/ · ai/ · frontend/ · infra/`, with harnesses under `ai/harness/`.
  Mirrored in `CLAUDE.md`, `AGENTS.md`, both READMEs and `PLAN.md` §3.

## Open questions (clarify before planning)

All resolved during planning:

- [x] Terraform or Bicep for the `infra/` gate? → **Bicep**, per the brief. Constitution amended on
      purpose and the amendment recorded.
- [x] Top-level `harness/` (brief) or the template's layer model? → **`ai/harness/`**, reconciling
      both. Recorded as deviation D-5 in `PLAN.md` §8.
- [x] README with a PT-BR section (brief) or a separate file (template)? → **separate
      `README.pt-BR.md`**, matching the template's own language switcher. Deviation D-4.
- [x] Keep constitution §7 (bilingual UI strings)? → **Yes.** Public UI, Brazilian audience.
- [x] Does a scaffold need TDD? → **No.** The constitution's own table classifies chores as
      "no spec, no TDD". This spec exists because the scaffold sets cross-cutting contracts, but its
      verification is structural (AC1–AC11) plus `verify-gates`, not a red→green cycle. Applying the
      rule honestly beats cargo-culting a failing test onto file creation.

## Out of scope / deferred

- Importing the Dataside design system from Claude Design → **spec 004**, blocked on `/design-login`.
- Filling `docs/architecture.md` with the real running system → specs 003–006, as the system exists.
- Provisioning any Azure resource → spec 002 onward.
