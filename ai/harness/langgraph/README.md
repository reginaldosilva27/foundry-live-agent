# `langgraph/` — a LangGraph graph that Foundry runs as a hosted agent

**This works.** It is deployed, it answers real questions, and the fixtures in
[`../../tests/fixtures/recorded/`](../../tests/fixtures/recorded/) are recordings of it doing so on
**2026-09-16** (spec 018). Until then this directory was a scaffold whose every method raised, and
this README said so; both are gone.

It is the repository's **second harness**, and the reason the first one's contract can be believed:
`ai/tests/conformance.py` proved it without being edited (spec 001's claim, finally tested).

## What it is

```
                     ┌─ the agent: ai/harness/langgraph/agent/ ───────────────┐
Browser → BFF ──────>│  StateGraph  agent → tools → agent                     │
        (adapter.py) │  tools: _shared/tools/ + Microsoft Learn (MCP client)  │
                     └─ a container image, run by Foundry, 1 vCPU / 2 GiB ────┘
```

| | |
|---|---|
| Protocol | **Responses**, via `ResponsesHostServer` — the platform then manages conversation history and the streaming lifecycle |
| Model calls | Responses API on the project endpoint, injected as `FOUNDRY_PROJECT_ENDPOINT`. **Not** through the AI Gateway, matching the prompt agent's deliberate bypass |
| Microsoft Learn | **The container is the MCP client.** Not Foundry — see *The two findings* |
| Function tools | The same `_shared/tools/` the BFF runs. Copied into the image, never vendored |
| Graph state | **No checkpointer** — see *Where state lives* |
| Deployment | `azure.yaml` + `azd`, generated from `agent.yaml` |
| Voice | Voice Live attaches. Verified live, 2026-09-16 |

## The two findings

**1. Where the tools run.** A hosted agent owns its loop, so it calls its own tools. Every
`function_call` it emits arrives already paired with its `function_call_output` — the BFF has
nothing to answer, which is why `adapter.py` has no loop and `submit_tool_output` is unreachable.
Tool rows read `foundry` instead of `bff`; the row is otherwise identical, because the tool is
identical.

The alternative — make the graph `interrupt()` on every tool so the BFF answers it — was rejected.
It would have repurposed human-in-the-loop machinery to make a hosted agent impersonate a prompt
agent, hiding exactly the difference this repo exists to show.

**2. Who is the MCP client.** With a prompt agent, Foundry holds the MCP session for you and a Learn
search arrives as an `mcp_call`. Here the container holds it, so **this harness never emits
`mcp_call`** — the same work arrives as ordinary tool calls. Two consequences worth knowing:

- the tool names are the Learn server's own three (`microsoft_docs_search`,
  `microsoft_code_sample_search`, `microsoft_docs_fetch`), not the single `microsoft_learn` label
  the definition uses;
- nothing in the app may treat a missing `mcp_call` as an error.

## What it costs, measured

Not from the documentation — from the recordings.

| | prompt agent | hosted agent |
|---|---|---|
| Token usage | reported | **`usage: null`** — no tokens reported at all |
| Reasoning summaries | `detailed`, card fills | **none**; the card stays empty (spec 015 made that survivable) |
| `response.completed` per turn | 2 (usage summed, `done` held back) | 1 |
| Traces | join on `gen_ai.response.id` | **no span carries it**; they key on `microsoft.session.id` = `agent_session_id` |
| Tool spans | a BFF-run tool leaves none | `execute_tool get_current_datetime` **is** a span — the container is instrumented |
| Compute | none to pay for | billed per active session |

The trace finding is the sharpest: the trace panel's query (spec 005) finds nothing for this
harness. Carrying `agent_session_id` on `trace_ids` would fix it and is an `AgentEvent` change, so
it needs its own spec (§9). The finding ships; the change does not.

## Where state lives

The old README warned that this was easy to get wrong, so: **the graph has no checkpointer, and
conversation state stays Foundry's.** With no checkpointer the host replays the Responses history
into the graph on every turn; with one it would send only the current input and key state by
conversation thread. Adding one would mean this repository owned state the platform already owns —
which §8 names outright — and would make the two harnesses differ in two ways instead of the one
this spec is about.

Separately, and not a substitute: each session has a persistent `$HOME` and `/files`, kept across
idle periods and deleted after 30 days of inactivity. Nothing here writes to them.

## Deploy it

```bash
just hosted-config    # regenerate azure.yaml from agent.yaml (a test fails if you forget)
just hosted-build     # build the image — context is ai/, see the Dockerfile
just hosted-deploy    # azd provision && azd deploy
just hosted-record    # record a live turn as a fixture
```

Prerequisites: Docker running, `azd` ≥ 1.27.1 with the `azure.ai.agents` extension, and
**Foundry Project Manager** on the project.

### Two manual steps, because they cannot be expressed in `azure.yaml`

Both need the **agent identity**, which does not exist until after the first deploy. Documented
rather than shipped as unverified IaC (§5).

**1. Model access — TWO identities, and both were missing a role here.** The documentation says the
agent identity has implicit access to model inferencing. Observed 2026-09-16: it does not. Worse,
granting the agent identity alone made it work *intermittently* — turns succeeded for half an hour,
then went back to `401`.

The reason is that two identities are in the path, and the second one is easy to miss:

```
container (AGENT identity) ──> project endpoint ──> account deployment
                                       └─ proxied using the PROJECT's managed identity
```

The permissions doc says the project's managed identity "needs access to the Foundry account to
perform model inference through the project endpoint" and that the assignment "**might** be created
automatically when the project is created, depending on the permissions of the user creating it."
On this project it was not created, and nothing says so until a hosted agent tries to reach a model.

Grant both:

```bash
ACCOUNT="<the Foundry ACCOUNT resource id>"
PROJECT="$ACCOUNT/projects/<project-name>"

# (a) the PROJECT's managed identity, on the ACCOUNT — the hop the docs assume already works
PROJECT_MI=$(az rest --method get \
  --url "https://management.azure.com$PROJECT?api-version=2025-04-01-preview" \
  --query "identity.principalId" -o tsv)
az role assignment create --role "Foundry User" \
  --assignee-object-id "$PROJECT_MI" --assignee-principal-type ServicePrincipal --scope "$ACCOUNT"

# (b) the AGENT identity, which does not exist until after the first deploy
AGENT_OID=$(azd ai agent show <agent-name> --query "instanceIdentityPrincipalId" -o tsv)
az role assignment create --role "Foundry User" \
  --assignee-object-id "$AGENT_OID" --assignee-principal-type ServicePrincipal --scope "$PROJECT"
az role assignment create --role "Foundry User" \
  --assignee-object-id "$AGENT_OID" --assignee-principal-type ServicePrincipal --scope "$ACCOUNT"
```

Allow a few minutes for propagation. **Read the error text, it distinguishes the two cases:**

| Symptom | Meaning |
|---|---|
| `401 … lacks the required data action …/chat/completions/action` | the **agent** identity has no model access |
| `401 — Principal does not have access to API/Operation` | either still propagating, or the **project MI** cannot reach the account deployment |

The second message is the one that cost the most time, because it also appears while a correct
assignment propagates — so it reads like patience when it is actually a missing role.

**2. `TAVILY_API_KEY`, for `search_web`.** Secrets belong in neither the image nor the agent
version, so the version carries `KEY_VAULT_URI` — an address — and `agent/host.py` reads the secret
`tavily-api-key` at startup with the agent's own identity. Grant it and point at the vault:

```bash
az role assignment create --role "Key Vault Secrets User" \
  --assignee-object-id "$AGENT_OID" --assignee-principal-type ServicePrincipal \
  --scope "<the Key Vault resource id>"
azd env set KEY_VAULT_URI "https://<vault>.vault.azure.net/" && azd deploy
```

**A Foundry *Key Vault connection* is not this.** It is a bring-your-own vault for Foundry's own
connection secrets — one per Foundry resource, and creatable only on a resource with no existing
connections. It gives the container no way to read an application secret. Spec 018's AC7 originally
said otherwise and was amended.

Leave `KEY_VAULT_URI` blank and the agent still runs: `search_web` answers `search_unavailable`,
which the instructions already tell it how to handle.

## How it was proven

Not by new contract tests. By the existing one:

```python
from tests.conformance import run_conformance

await run_conformance(LangGraphAdapter(...))
```

`ai/tests/conformance.py` is byte-identical to its state before spec 018. The only change on the
conformance side was registering this adapter in `tests/test_conformance.py`'s parameterisation —
which is what "parameterised over adapters" was always supposed to mean.

## Also possible later

`harness/agent-framework/` as a third column, using Microsoft Agent Framework's `FoundryChatClient`.
