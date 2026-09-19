# Development workflow — how we build here (SDD + TDD)

The contributor-facing companion to [`../.specify/constitution.md`](../.specify/constitution.md)
and [`../specs/README.md`](../specs/README.md). The constitution is the law; this is the how-to.

## The loop

```
spec.md ──clarify──> plan.md ──> tasks.md ──TDD──> code + tests ──> gates green
  WHAT/WHY            HOW          WORK             red→green→refactor
```

1. **Spec first (§1).** New feature or behavior change → copy `specs/_template/` to
   `specs/NNN-feature-name/` and fill `spec.md` (WHAT + WHY + testable acceptance criteria). Use the
   `new-spec` skill / `/new-spec` Codex prompt. Then **clarify**: run the `grilling` skill /
   `/grilling` prompt — it interviews you one question at a time until the open questions are
   resolved and the spec reaches `clarified`, before planning.
2. **Plan.** Fill `plan.md`: approach, affected files, contract/data/i18n impact, and a test strategy
   mapping each acceptance criterion to a test.
3. **Tasks.** Fill `tasks.md`: an ordered TDD checklist, each implement task preceded by its failing test.
4. **Implement (§2).** Red → green → refactor, one task at a time. Tests assert behavior, not internals.
5. **Verify (§3).** Run the `verify-gates` skill / `/verify-gates` prompt; everything green before a PR.

## Bug fixes

No spec, but still test-first: write a failing regression test that reproduces the bug, then fix it.

## Reviewing

Before opening a PR, spawn the read-only reviewers for the area you touched:
`code-reviewer`, `test-reviewer`, and (if you touched docs or strings) `docs-i18n-auditor`. They report;
they don't edit.

## Releasing

1. Move the `[Unreleased]` entries in `CHANGELOG.md` under a new `vX.Y.Z` heading.
2. `git tag vX.Y.Z && git push origin vX.Y.Z` — the Release workflow creates the GitHub Release with
   auto-generated notes. Pre-release tags (`-rc`, `-beta`) are flagged as pre-releases.

## Keeping the agents in sync (§6)

`CLAUDE.md` ↔ `AGENTS.md`, and each `.claude/skills`+`.claude/agents` ↔ its `.codex/prompts/`
counterpart. Change a rule in one, change it in the others in the same commit.

## Proposing a change to the agent from the screen (spec 041)

The file stays the truth; the screen is a better editor **of the file**. You edit the instructions,
and the app hands back a diff to review, merge and apply — it does not save, and it says so.

```
/agents/{name}  ──edit──>  POST /agents/{name}/definition/proposal
                             validates through agent_spec.py
                             answers { yaml, diff }        <- writes NOTHING
                           review · merge · just agent
```

**Why it cannot simply save.** §8 would permit it: a person configuring an agent is configuring,
not running a loop. §4 refuses it. `agent_core.yaml` exists *because* two copies of those
instructions drifting a sentence at a time would make the repository's central claim — that only
the harness differs between the two agents — unfalsifiable. A save creates the second copy on the
first click, and `docs/harness-comparison.md` quietly stops meaning anything.

Three things the screen is careful about:

- **It edits the file that actually declares the instructions.** A harness's own `agent.yaml` does
  not: it `extends:` the shared core. So editing "the prompt agent's" instructions edits the hosted
  agent's too, and the screen names both.
- **It calls the definition what it is**: the one this build was made from. Not "the repository",
  not `main`. In a container the files are whatever was baked into the image.
- **It states drift before any editing.** A deployment serving something other than what this build
  describes is the most useful thing on the screen, and a reader needs it before they start rather
  than after they wonder why nothing changed.

**Instructions only.** Tools are where a bad edit breaks a harness silently, and the model's shape
decides whether inference routes through the gateway. **No pull-request creation**: it would cost a
code-host credential — a second third-party secret after `TAVILY_API_KEY` — to buy a button that
saves a `git apply`.

Off by default (`FOUNDRY_ALLOW_PROPOSALS`). Nothing here writes, so the flag gates a surface rather
than a permission.

