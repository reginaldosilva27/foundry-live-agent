# Plan: Project scaffold

| | |
|---|---|
| **Spec** | [spec.md](spec.md) |
| **Status** | done |

## Approach

Copy the generic parts of [`agentic-coding-template`](https://github.com/reginaldosilva27/agentic-coding-template)
verbatim, and **rewrite only what is project-specific**. Verbatim where the template is already
right; rewritten where this project genuinely differs. Every rewrite is listed below with a reason,
so a reader can diff against the template and see intent rather than drift.

| File | Treatment | Reason |
|---|---|---|
| `specs/_template/*.md` | **verbatim** | Generic and correct |
| `.claude/skills/{new-spec,grilling}/` | **verbatim** | Workflow skills, stack-agnostic |
| `.claude/agents/*.md` | **verbatim** | Review subagents, stack-agnostic |
| `.codex/prompts/{new-spec,grilling,review-*}.md` | **verbatim** | Twins of the above (§6) |
| `.github/{ISSUE_TEMPLATE,PULL_REQUEST_TEMPLATE.md,dependabot.yml}` | **verbatim** | Generic |
| `.github/workflows/release.yml`, `.editorconfig`, `.gitignore` | **verbatim** + Azure ignores | Generic; `.azure/` added for azd |
| `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md` | adapted | Project name, layers, contact |
| `.specify/constitution.md` | **rewritten** | §8–§10 added; `infra/` gate → Bicep; §7 kept |
| `.github/workflows/ci.yml` | **adapted** | `infra` job: Terraform → Bicep (`az bicep build/lint`) |
| `.claude/skills/verify-gates/SKILL.md` + `.codex/prompts/verify-gates.md` | **adapted** | Same Bicep change + §8/§9/§10 cross-cutting gates |
| `CLAUDE.md`, `AGENTS.md` | **rewritten** | Real architecture, real commands, project invariants |
| `README.md`, `README.pt-BR.md` | **rewritten** | This project, not the template |
| `.env.example` | **rewritten** | Foundry variables; **no** `ANTHROPIC_API_KEY`/`DATABASE_URL` |
| `justfile` | **new** | Not in the template; the brief asks for a task runner |
| `backend/ai/frontend/infra/README.md` | **rewritten** | Name what lives there + which spec fills it |

## Affected files

Everything is new — the repo currently holds only `PLAN.md`, `docs/REFERENCES.md` and
`.specify/constitution.md` (written during planning, ahead of this spec).

## Contract / data impact

Establishes the **gate command set** and the **layer map** as cross-cutting contracts (see spec
§"Contract / data impact"). Four files mirror the gates; they move together from here on.

Deliberate divergence from the template, recorded so it is never mistaken for drift:

1. `infra/` is **Bicep**, not Terraform — amended in the constitution's *Amendment process* table.
2. Constitution **§7 kept**, not deleted — public UI, Brazilian audience.
3. Constitution **§8/§9/§10 added** — the project-specific invariants.
4. Harnesses live at **`ai/harness/`** — reconciles the brief's `harness/` with the layer model.

## i18n impact

`README.md` ↔ `README.pt-BR.md` (§7). No UI strings yet — `frontend/src/i18n/strings.ts` arrives in
spec 004.

## Test strategy

This is a **chore-class change** under the constitution's own table (docs/chores → no spec, no TDD).
It carries a spec only because it sets cross-cutting contracts. Verification is therefore structural
rather than red→green:

| AC | Verified by |
|---|---|
| AC1–AC4, AC6–AC10 | File-existence and content inspection, itemised in `tasks.md` |
| AC5, AC11 | Run each layer's gate locally; each must exit 0 with a skip notice |

AC11 is the real check: **the gates must be green on an empty repo**, so spec 001 starts from green
and any red is caused by spec 001 rather than inherited from the scaffold.

The first genuine red→green cycle is **spec 001** (the `HarnessAdapter` contract tests).

## Risks

- **Template drift.** Copying rather than submoduling means upstream fixes don't flow in. Accepted:
  the template is a starting point by design, and the divergence table above makes a manual re-diff
  cheap.
- **Stub docs reading as finished.** `docs/architecture.md` cannot be written honestly before the
  system exists (§5). Mitigation: the stub states which spec fills it, rather than describing a
  system that does not run yet.
