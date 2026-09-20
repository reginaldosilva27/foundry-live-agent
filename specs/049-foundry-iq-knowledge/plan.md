# Plan: Foundry IQ as a knowledge source

> The HOW. Written after `spec.md` reached `clarified` on 2026-09-20.

## Approach

**One new class, one changed line, and no other production code.**

`knowledge_tool.py` already declares the seam and even names the class that would fill it:

```python
@runtime_checkable
class KnowledgeSource(Protocol):
    """Anything that can answer a query with ranked passages.

    Implement this to swap the backing store. ``FoundryIqKnowledge`` will be one of these.
    """
    def search(self, query: str, limit: int) -> list[Passage]: ...
```

So the work is `FoundryIqKnowledge`, implementing `search`, calling
`POST {search_endpoint}/knowledgebases/{kb}/retrieve?api-version=2026-04-01` with a bearer token
from `DefaultAzureCredential` at scope `https://search.azure.com/.default`, and mapping the
response's `references` onto the existing `Passage`.

**`Passage` does not change, and that is a decision, not an accident.** It is
`(text, source, score)`. Foundry IQ's references are mapped onto exactly those three fields, so
`lookup_knowledge`'s output shape is byte-identical in structure and **`frontend/src/state/sources.ts`
needs no change at all** — AC2 then holds *by construction* rather than by a rule, the same way
spec 020's independent columns did. The frontend diff for this spec is empty.

That choice is also the honest one about citations. The doc says a **search-index** knowledge source
falls back to the knowledge base's own MCP endpoint as its citation URL — a URL that is not a page
anyone can open. `readKnowledge` in `sources.ts` renders `source` as a path and never as a link
(spec 034), which is exactly right for it. Mapping a reference's *document name* into `source` keeps
that true. If a future spec adds a blob knowledge source with real document URLs, *that* spec earns
the `sources.ts` change.

**Choosing between the two implementations** follows `_search_backend()`'s existing precedent
(`registry.py`), which reads its configuration inside the factory and lets the backend report a
missing key rather than refusing to register the tool. `_knowledge_source()` does the same: when the
search endpoint and knowledge base name are both configured it returns `FoundryIqKnowledge`,
otherwise `LocalMarkdownKnowledge`. One line, one home (§4).

**Failure is loud (AC5).** `FoundryIqKnowledge` never falls back to markdown. A 403 from a missing
`Search Index Data Reader` becomes a message in the tool's own result — visible in the activity
panel — because a silent fallback would make the app lie about where an answer came from (§5) and
would quietly turn spec 020's comparison into a comparison of two different agents.

### Alternatives considered

- **The MCP tool on the agent definition** — rejected at clarify; it moves retrieval to Foundry and
  deletes a round trip. Recorded in `docs/REFERENCES.md` as the road not taken.
- **Extending `Passage` with a `url`** — rejected: with a search-index knowledge source the only URL
  available is the MCP endpoint, which must not render as a link. Adding a field nothing can fill
  honestly is the §5 problem in miniature.
- **Falling back to markdown on failure** — rejected; it is AC5's inverse and the spec says why.

## Affected files

- `ai/harness/_shared/tools/knowledge_tool.py` — **new** `FoundryIqKnowledge`. `Passage`,
  `KnowledgeSource`, `SCHEMA` and `lookup_knowledge` untouched.
- `ai/harness/_shared/tools/registry.py` — `_knowledge_source()` picks by configuration. One line
  plus the import.
- `backend/app/settings.py` — the two settings, and the derived `foundry_iq_enabled` for `/config`.
- `backend/app/routers/config.py` — one field.
- `frontend/src/panes/aboutFields.ts` — the same field in `COVERED_CONFIG_KEYS`, or CI fails
  (spec 032's drift test).
- `frontend/src/i18n/strings.ts` — the `/about` label, `en` + `pt`.
- `.env.example` — `FOUNDRY_SEARCH_ENDPOINT`, `FOUNDRY_KNOWLEDGE_BASE`, with the Free-tier caveats.
- `docs/REFERENCES.md` — already written at clarify; add whatever the first real run teaches.
- `docs/architecture.md`, `ai/harness/README.md` — what `lookup_knowledge` is backed by now.
- `README.md` + `README.pt-BR.md` — the manual setup steps (§7, they move together).
- **Not changed, and asserted**: both `agent.yaml` files, `frontend/src/state/sources.ts`.

## Contract / data model changes (constitution §4)

| | |
|---|---|
| **`AgentEvent`** | Unchanged. `tool_call` / `tool_result` as today (§9). |
| **Source of truth for the seam** | `KnowledgeSource` in `knowledge_tool.py`. `registry.py:_knowledge_source()` is the only place the choice is made. |
| **`lookup_knowledge` output** | Unchanged: `{query, passages: [{text, source, score}]}`. This is what makes the frontend diff empty. |
| **`GET /config`** | Gains one boolean. `config.py` and `aboutFields.ts` move in the same commit or `About.coverage.test.ts` fails. |
| **Agent definitions** | Unchanged, and AC4 asserts it by reading both YAML files. |

No migration: an existing deployment with no new settings keeps the local markdown.

## i18n strings (constitution §7)

| key / location | en | pt |
|---|---|---|
| `about.foundryIq` | Knowledge retrieval | Recuperação de conhecimento |
| `about.foundryIq.on` | Foundry IQ | Foundry IQ |
| `about.foundryIq.off` | Local files | Arquivos locais |

Nothing else is user-facing: the tool's failure text travels as the tool's own result, which the
activity panel renders verbatim, the way `search_unavailable` already does (spec 042).

## Test strategy (constitution §2 — TDD)

Recorded fixtures, never hand-written (§5). `ai/tests/fixtures/recorded/` gains one retrieve
response captured from the live service, redacted with the existing script.

| Acceptance criterion | Test | File |
|---|---|---|
| AC1 | a configured source returns passages, and the tool's output shape is unchanged | `ai/tests/test_knowledge_foundry_iq.py` |
| AC2 | `sourcesOf` renders a Foundry IQ turn identically to a local one — **driven by the recorded payload** | `frontend/src/state/sources.test.ts` |
| AC3 | unconfigured → `LocalMarkdownKnowledge`, and every existing knowledge test still passes | `ai/tests/test_tool_registry.py` |
| AC4 | both `agent.yaml` files and `SCHEMA` are unchanged, asserted by reading them | `ai/tests/test_knowledge_foundry_iq.py` |
| AC5 | a 403 surfaces in the result and **`LocalMarkdownKnowledge.search` is never called** — asserted by patching it, not by reading the source | `ai/tests/test_knowledge_foundry_iq.py` |
| AC6 | the existing adapter-parameterised contract suite, unedited | `ai/tests/test_contract.py` |
| AC7 | the container's tool list resolves to the same `KnowledgeSource` instance the BFF gets | `ai/tests/test_hosted_tools.py` |
| AC8 | a query with no match returns `passages: []` and no error, from a recorded empty response | `ai/tests/test_knowledge_foundry_iq.py` |
| AC9 | `/config` reports it and `/about` renders it | `backend/tests/test_config.py`, `frontend/src/panes/About.coverage.test.ts` |
| AC10 | n/a — documentation, verified by following it once and saying so | — |
| AC11 | every key exists in `en` and `pt` | `frontend/src/i18n/strings.test.ts` (existing, no edit) |
| AC12 | n/a — `docs/REFERENCES.md`, reviewed | — |

AC5's "never called" is asserted by **patching `LocalMarkdownKnowledge.search` and asserting it was
not called**, rather than by inspecting `FoundryIqKnowledge` for the absence of a fallback — the same
technique spec 042 used to prove the playground goes through `tool_executor.execute`.

## Risks / trade-offs

- **The setup is manual and a reader can get it wrong.** Four things to create and two role
  assignments. Mitigated by AC10 and by failing loudly rather than degrading (AC5).
- **A free search service may be deleted after inactivity.** Stated in `.env.example` and in the
  README. A deployment that loses it starts failing loudly, which is the designed behaviour, not a
  regression.
- **Retrieval latency lands inside the function-call round trip.** `maxRuntimeInSeconds` defaults to
  **90s** and Foundry expires an unanswered function call at **10 minutes**, so the default fits —
  but the two numbers must be read together, and the first live run should confirm the real figure
  against spec 020's recorded baseline.
- **`gpt-5.5` may call the tool less, or more, once its answers improve.** Spec 020's recordings are
  the before-picture; re-running `compare_harnesses.py --probe round-trip` afterwards is cheap and
  is the only honest way to claim an improvement.
- **Blocked on infrastructure.** No search service exists. Every task below through T3 can be
  written and red before that; nothing can go green without it.
