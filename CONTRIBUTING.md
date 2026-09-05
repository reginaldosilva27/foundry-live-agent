# Contributing

Thanks for considering a contribution. This project is a public reference and teaching material, so
clarity matters as much as correctness.

## Before you write code

This repository is **spec-first and test-first** — see [`.specify/constitution.md`](.specify/constitution.md)
(the law) and [`specs/README.md`](specs/README.md) (the workflow). In short:

| Change | Spec? | TDD? |
|---|---|---|
| New feature, new user-facing behavior, public contract/schema change | **Yes** | Yes |
| Any change to the `AgentEvent` set (§9) | **Yes, always** | Yes |
| Bug fix · small adjustment · behavior-preserving refactor | No | **Yes** — failing regression test first |
| Docs · comments · formatting · dependency bumps | No | n/a |

When unsure, write the spec. Copy `specs/_template/` to `specs/NNN-feature-name/`, fill `spec.md`,
then run the `grilling` skill (or `/grilling` in Codex) to clear the open questions before planning.

## The three rules that get PRs sent back

1. **§8 — no agent-loop logic in `backend/` or `frontend/`.** Choosing *which* tool to call,
   re-prompting the model, or looping on model output belongs in Foundry. *Executing* a function tool
   Foundry asked for is fine — that's the documented client-side contract. Ask yourself: *"would this
   still be true if the harness were swapped?"*
2. **§9 — don't reshape `AgentEvent` casually.** It is the boundary between every harness and the
   rest of the app. Changing it means a spec, plus moving its consumers, fixtures and docs in the
   same change.
3. **§10 — don't write a Foundry API from memory.** Foundry changed substantially through 2026 and
   model training data is unreliable about it. Read the doc, use it, and add the URL to
   [`docs/REFERENCES.md`](docs/REFERENCES.md) in the same PR. If you can't confirm a value, verify it
   against the live service and record a fixture, or mark it as an open question — don't guess.

## Running the gates

```bash
just verify     # everything CI runs; a layer with no code yet skips clean
just fmt        # fix what is auto-fixable
```

A change is **done** only when the gates are green. Never declare done on red — paste the failing
output instead.

## Conventions

- **Code and comments in English.** Documentation in English; the README is mirrored in Portuguese.
- **Every user-facing string ships `{ en, pt }`** (§7). `README.md` and `README.pt-BR.md` move together.
- **Zero secrets.** Entra ID via `DefaultAzureCredential`; `.env.example` holds placeholders only.
- **Honesty (§5).** Test fixtures are recorded from real runs, never hand-written to make a test
  pass. Scaffolds say they are scaffolds.
- **Keep the agents in sync (§6).** A rule changed in `CLAUDE.md` changes in `AGENTS.md` and the
  `.claude`/`.codex` workflows in the same commit.

## Before opening a PR

Spawn the read-only reviewers for the area you touched: `code-reviewer`, `test-reviewer`, and — if
you touched docs or user-facing strings — `docs-i18n-auditor`. They report; they don't edit.

## Reporting issues

Use the issue templates. For anything security-related, follow [`SECURITY.md`](SECURITY.md) instead
of opening a public issue.
