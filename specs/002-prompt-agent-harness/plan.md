# Plan: Prompt-agent harness

| | |
|---|---|
| **Spec** | [spec.md](spec.md) |
| **Status** | in-progress — the Azure-dependent half is blocked (see *Sequencing*) |

## Sequencing — the spike gates the adapter

The work splits cleanly along one line: **does it need a live Foundry project?**

| | Needs Azure | Buildable now |
|---|---|---|
| The two tools + registry | No | ✅ |
| `agent.yaml` + loader | No | ✅ |
| `apply_agent.py` (the code) | No to write, yes to run | ✅ write, ⛔ run |
| `spike.py` | Yes to run | ✅ write, ⛔ run |
| Recorded fixtures | **Yes** | ⛔ |
| `PromptAgentAdapter` + event normaliser | Depends on the fixtures | ⛔ |

The adapter is deliberately last. Writing an event normaliser before observing the events would mean
inventing names and then discovering them — the exact failure mode constitution §10 exists to
prevent. So this spec lands in two passes, and stays `in-progress` between them.

## Approach

### The tools

```
tools/
  registry.py        name -> ToolSpec(schema, callable). The ONLY place a name resolves.
  datetime_tool.py   get_current_datetime(timezone)
  knowledge_tool.py  lookup_knowledge(query) over a KnowledgeSource
  knowledge/         the local markdown corpus
```

Two design choices worth stating:

**Tools return values, never raise for expected failure.** An unknown timezone is a *result*
(`{"error": "unknown_timezone", ...}`), not an exception. A raised exception in a tool becomes a tool
call nobody answers, which hangs the Foundry run for ten minutes. The failure mode is bad enough that
the tools are written to make it impossible.

**`lookup_knowledge` depends on a Protocol, not a folder.**

```python
class KnowledgeSource(Protocol):
    def search(self, query: str, limit: int) -> list[Passage]: ...
```

`LocalMarkdownKnowledge` implements it today; `FoundryIqKnowledge` implements it later. The tool, its
schema and its registration do not change — AC3 proves that with a second implementation in a test.

Ranking is a transparent scored keyword match: term frequency in the passage, a bonus for a heading
match, normalised by passage length. Not embeddings — a "semantic search" that is really keyword
matching would claim a capability it doesn't have (§5). The docstring says so.

### Agent as code

`agent.yaml` is **our** schema (`schema_version: foundry-live-agent/v1`), because Foundry's is
deprecated. `agent_spec.py` loads and validates it, and **cross-checks every declared function tool
against the registry** — a definition naming a tool nobody implements is caught at load time rather
than as a hung run in production.

`apply_agent.py` maps it onto `PromptAgentDefinition` + `FunctionTool` + `MCPTool` and calls
`project.agents.create_version(...)`.

### The spike

`ai/scripts/spike.py` — one script, no framework, that prints what it observes:

1. Create an agent version on `apim-analytics-demo/gpt-5.4` with all three tools.
2. `responses.create(stream=True)` with a prompt that forces a function call **and** an MCP call.
3. Print **every raw event type in arrival order** → answers **O-1**.
4. Record the raw stream to `tests/fixtures/recorded/` → the fixture spec 003 is written against.
5. Report whether reasoning summary events appeared → answers **O-9**.
6. Report whether the whole thing worked at all on a BYOM model → answers **O-8**.
7. Re-run with `require_approval: "never"` on the MCP tool → answers **O-3**.

It writes findings to stdout in a form that can be pasted into `docs/REFERENCES.md`. If step 2 fails
with the BYOM model, it retries on a plain deployment, which distinguishes "BYOM is the problem" from
"our request is the problem".

## Affected files

| File | What |
|---|---|
| `ai/harness/_shared/tools/{registry,datetime_tool,knowledge_tool}.py` | New |
| `ai/harness/_shared/tools/knowledge/*.md` | New — the corpus |
| `ai/harness/_shared/agent_spec.py` | New — loader + validator |
| `ai/harness/prompt_agent/agent.yaml` | New — the definition |
| `ai/scripts/{apply_agent,spike}.py` | New |
| `ai/harness/langgraph/{README.md,adapter.py}` | New — scaffold, raises `NotImplementedError` |
| `ai/tests/test_{tools,agent_spec}.py` | New |
| `ai/harness/prompt_agent/{adapter,events}.py` | **Second pass**, after the spike |
| `docs/REFERENCES.md` | Spike findings (§10) |

## Contract / data impact

Consumes §9 unchanged. If the spike surfaces an event the vocabulary can't express, that is a §9
change and gets its own spec — the process working, not failing.

## i18n impact

None. Tool outputs are data. The knowledge corpus is English (the agent answers in the user's
language regardless).

## Test strategy

| AC | Test |
|---|---|
| AC1 | `test_datetime_*` — known zone, unknown zone returns structured error, offset present |
| AC2 | `test_knowledge_*` — ranked hits, source attribution, empty corpus, no match |
| AC3 | `test_swapping_knowledge_source_needs_no_tool_change` — a second `KnowledgeSource` |
| AC4 | `test_registry_*` — lookup, unknown name raises typed error |
| AC5 | `test_every_schema_is_valid_function_tool_shape` — over the whole registry |
| AC6 | `test_no_tool_module_imports_an_agent_or_another_tool` — AST import inspection |
| AC7 | `test_agent_spec_*` — loads, rejects unknown tool, rejects bad schema_version |
| AC8–AC11 | **Blocked on Azure.** Second pass. |

AC6 deserves a note: it is a **test that enforces an architectural rule**, which is unusual and
deliberate. §8 says the app never decides which tool to call. A test that reads the import graph is
the cheapest way to keep that true when someone later adds a third tool in a hurry.

## Risks

- **The spike may invalidate the streaming design (O-8).** That is precisely why it runs first and
  why nothing is built on top of it yet. Cost of finding out now: one script. Later: the BFF.
- **The knowledge corpus can drift into marketing.** It is a demo corpus; it should be small, real,
  and about this project, so `lookup_knowledge` returns something a reader can verify.
