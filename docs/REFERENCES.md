# References

Every Microsoft Learn page actually read while planning this repository, with the API versions,
package versions and identifiers taken from each one.

**All pages read on 2026-09-04.** Foundry moves fast: re-verify before relying on anything here.
Where a page's own `ms.date` / last-updated is known it is noted, because that is a better staleness
signal than the date I read it.

---

## Foundry Agent Service — concepts

| Page | URL | Taken from it |
|---|---|---|
| What is Foundry Agent Service? | https://learn.microsoft.com/en-us/azure/foundry/agents/overview | Prompt vs. hosted agent comparison table; agent types; toolboxes; publishing (M365 Copilot, Teams, Entra Agent Registry); OpenResponses / Activity / Invocations / A2A protocols. Updated 2026-08-27. |
| What is Microsoft Foundry? | https://learn.microsoft.com/en-us/azure/foundry/what-is-foundry | **The migration table**: Assistants API (v0.5/v1) → **Responses API (Agents v2)**; Threads/Messages/Runs/Assistants → **Conversations/Items/Responses/Agent Versions**; monthly `api-version` → **v1 stable routes** (`/openai/v1/`); multiple SDKs → **`azure-ai-projects` 2.x**. Updated 2026-08-27. |
| Hosted agents | https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/hosted-agents | Container contract; Responses / Invocations / Invocations-WS / Activity / A2A protocols; per-session VM-isolated sandbox; `$HOME` + `/files` persistence; **idle timeout 5–60 min, default 15**; session deleted after 30 days; immutable versions; sandbox sizes (0.5/1/2 vCPU); LangGraph named as a supported framework; region list incl. Brazil South. Updated 2026-08-27. |
| Toolbox overview | https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/toolbox-overview | Toolbox = curated tools behind one MCP-compatible endpoint. **Supported-tools table: Function calling is ❌ in Toolbox — "client-side execution" — ✅ direct only.** Tool search and Skills (preview). Updated 2026-07-31. |
| agent.yaml schema reference | https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/agent-yaml-reference | **`agent.manifest.yaml` and `agent.yaml` are DEPRECATED**; superseded by a single `azure.yaml` as of Foundry `azd` extensions **`azure.ai.agents` 1.0.0-beta.1**. AgentDefinition kinds: `prompt`, `hosted`, `workflow`. Retained for reference only. Updated 2026-07-07. |
| Agent tracing overview | https://learn.microsoft.com/en-us/azure/foundry/observability/concepts/trace-agent-concept | Tracing **GA for prompt and hosted agents**; stored in Application Insights; OpenTelemetry GenAI semantic conventions. Span names: `invoke_agent`, `invoke_workflow`, `plan`, `execute_tool`, memory ops. Attributes: `gen_ai.tool.definitions`, `gen_ai.tool.call.arguments`, `gen_ai.tool.call.result`. Requires Log Analytics reader. Updated 2026-08-28. |

## Foundry Agent Service — quickstarts and how-tos

| Page | URL | Taken from it |
|---|---|---|
| Quickstart: create a prompt agent | https://learn.microsoft.com/en-us/azure/foundry/agents/quickstarts/prompt-agent | **`pip install "azure-ai-projects>=2.3.0" azure-identity`** (2.x, *incompatible with 1.x*). `AIProjectClient(endpoint, credential=DefaultAzureCredential())`; `project.agents.create_version(agent_name=…, definition=PromptAgentDefinition(model=…, instructions=…))`; `project.get_openai_client(agent_name=…)`; `openai.conversations.create()`; `openai.responses.create(conversation=…, input=…)`. Project endpoint format `https://<resource>.services.ai.azure.com/api/projects/<project>`. REST: `…/agents/{name}/endpoint/protocols/openai/responses?api-version=v1`. Token scope **`https://ai.azure.com/.default`**. Updated 2026-09-04. |
| Quickstart: Responses API | https://learn.microsoft.com/en-us/azure/foundry/agents/quickstarts/responses-api | Ephemeral-agent pattern; project endpoint Responses route **`{project_endpoint}/openai/v1/responses`**; what the project endpoint adds over plain OpenAI (project-scoped data, Foundry models, OBO auth, project observability). `agent-framework-foundry` / `FoundryChatClient` as the recommended non-prompt path. Updated 2026-07-07. |
| Function calling | https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/function-calling | **The round trip.** `FunctionTool(name, parameters, description, strict)` from `azure.ai.projects.models`; output item `type: "function_call"` with `call_id`/`name`/`arguments`; submit `FunctionCallOutput(type="function_call_output", call_id, output)`; `extra_body={"agent_reference": {"name": …, "type": "agent_reference"}}`. **Runs expire 10 minutes after creation.** Portal cannot add/update function definitions — SDK/REST only. Updated 2026-07-16. |
| Connect agents to MCP servers | https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/model-context-protocol | `MCPTool(server_label=…, server_url=…, require_approval=…)` from `azure.ai.projects.models`; `allowed_tools` allow-list; `MCPToolboxTool` for the toolbox variant; approval flow via `McpToolCallApprovalRequestItem`. Examples consistently use `require_approval="always"`. Updated 2026-09-01. |

## The gateway — verified against the live service, 2026-09-16

**The agent's inference already routes through APIM.** The project carries a connection of category
`ApiManagement` targeting `https://apim-foundry-belake.azure-api.net/<account>`, authType `ApiKey`,
and the deployment name is `<connection>/<model>` — the shape the bring-your-own-model page
describes. `GET /config` reports `uses_gateway: true` off that. So the *project-level* AI Gateway
page showing **Enabled** and the agent actually using a gateway are two different facts that happen
to both be true here; the second is what BYOM bought.

**APIM is emitting telemetry and it has nowhere to land.** A logger `azuremonitor` (type
`azureMonitor`) exists, a service-level diagnostic points at it with **100 % sampling**, and the
resource has **zero Azure Monitor diagnostic settings** — so nothing is stored anywhere.

Diagnostic log categories actually offered by this APIM instance (`az monitor diagnostic-settings
categories list`), two of which the docs we had read never mentioned:

| Category | What it carries |
|---|---|
| `GatewayLogs` | HTTP request records — the source of a gateway request id |
| **`GatewayLlmLogs`** | **LLM-specific records for model traffic through the gateway** |
| **`GatewayMCPLogs`** | **MCP traffic through the gateway** |
| `WebSocketConnectionLogs`, `DeveloperPortalAuditLogs`, `AllMetrics` | not relevant here |

**One workspace can hold both halves.** The project's Application Insights is workspace-based
(`IngestionMode: LogAnalytics`) over
`DefaultWorkspace-c018b72e-…`, and the Foundry spans are already readable there as
**`AppDependencies`** — the workspace-native name for the same rows the App Insights `dependencies`
table returns. Pointing APIM's diagnostic setting at that same workspace puts
`ApiManagementGatewayLogs` beside them, so one `LogsQueryClient` target — and one KQL join — can
read a run and its gateway record together.

## Agent tracing — verified against the live service, 2026-09-16

The tracing page (above) lists span names `invoke_agent`, `invoke_workflow`, `plan`, `execute_tool`
and attributes `gen_ai.tool.definitions`, `gen_ai.tool.call.arguments`, `gen_ai.tool.call.result`.
What this project's own runs actually produce, read back from Application Insights
`ai-admin2354ai223634534-project-appinsights-2442` and recorded in
`ai/tests/fixtures/recorded/appinsights-spans-20260916.jsonl`:

| Observed | Value |
|---|---|
| Table | `dependencies`. No `requests`, `traces`, `customEvents` or `exceptions` rows at all. |
| Span names | `invoke_agent <agent>:<version>`, `chat <model>`, `execute_tool <server>.<tool>` |
| Trace id | `operation_Id` — 32 hex, the OpenTelemetry trace id |
| Span id / parent | `id` / `operation_ParentId` — 16 hex |
| **Run correlation** | **`customDimensions["gen_ai.response.id"]` carries the exact `resp_…` our `trace_ids` event emits.** This is the join from a turn to its spans. |
| Other attributes | `gen_ai.agent.{id,name,version}`, `gen_ai.conversation.id`, `gen_ai.request.model`, `gen_ai.response.{id,model}`, `gen_ai.usage.{input_tokens,output_tokens,cached_tokens}`, `gen_ai.operation.name`, `gen_ai.provider.name = microsoft.foundry`, `span_type`, `microsoft.channel.name = agent_service` |
| `gen_ai.tool.call.arguments` / `.result` | **Not present** on any observed span. `gen_ai.tool.definitions` *is* present, on `invoke_agent`. |

**Three findings that shape spec 005, none of them in the docs:**

1. **A client-side function tool produces no `execute_tool` span.** A turn calling
   `get_current_datetime` — which the BFF executes — yields exactly `invoke_agent` + `chat`. A turn
   calling the Learn MCP server yields `invoke_agent` + `execute_tool …` per call + `chat`. Foundry
   traces what Foundry runs, which is the §8 boundary showing up in telemetry.
2. **One turn with a function-call round trip is *two* OTel traces**, not one — a separate
   `operation_Id` per leg, each with its own `gen_ai.response.id`. Our UI's "turn" does not map 1:1
   to a trace.
3. **`invoke_agent`'s `operation_ParentId` names a span that is not in the store.** The root is
   outside what the project can read; the readable tree is rooted at `invoke_agent`.

**Ingestion is staggered.** First spans of a run were queryable under 30 s; the *other* leg of the
same turn was not yet present at that point and was later. A trace must be treated as possibly
incomplete, not merely as present or absent.

**Gateway correlation is not available.** `apim-foundry-belake` has **zero diagnostic settings**, so
no `ApiManagementGatewayLogs` reach any workspace. Enabling them is a separate provisioning step
from connecting Application Insights to the project.

| Azure Monitor Query for Python | https://learn.microsoft.com/en-us/python/api/overview/azure/monitor-query-readme | Package **`azure-monitor-query`**, current **2.0.0**; Python **3.9+**. `LogsQueryClient` from `azure.monitor.query` (async in `azure.monitor.query.aio`, needs `aiohttp`), authenticated with `DefaultAzureCredential` from `azure-identity` — no key, which suits §*zero secrets*. **`query_resource(resource_id, query, timespan=…)`** queries an Azure resource directly, with **no workspace id** — the shape spec 005 needs, since the App Insights resource id is what the Foundry connection already names. Returns `LogsQueryResult` or `LogsQueryPartialResult` (`.status`, `.tables`, `.partial_error`); throttling surfaces as `LogsQueryError` with code `ThrottledError`; `server_timeout` defaults to 180 s, max 600. **`MetricsClient` was removed in 2.0.0** — metrics live in `azure-monitor-querymetrics`. Read 2026-09-16. |

## AI Gateway

| Page | URL | Taken from it |
|---|---|---|
| Configure AI Gateway in your Foundry resources | https://learn.microsoft.com/en-us/azure/foundry/configuration/enable-ai-api-management-gateway-portal | Portal flow **Manage → AI Gateway**; APIM **v2 tiers only**; "Create new" = **Basic v2**; enabled at resource level, **new projects on by default, existing added manually**; per-project TPM/quota; **429** on TPM, **403** on quota; verify with `ApiManagementGatewayLogs` KQL. **No Bicep/azd path documented** → Open Question O-4. Updated 2026-08-13. |
| Enforce token limits for models | https://learn.microsoft.com/en-us/azure/foundry/control-plane/how-to-enforce-limits-models | Per-project token limits (referenced, not read in full). |
| Govern MCP tools with an AI gateway (preview) | https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/governance | MCP traffic governance is a **separate preview** from model-traffic gateway (referenced, not read in full). |
| **Bring your own model to Foundry Agent Service** | https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/ai-gateway | **The page that corrected our architecture.** How to make *agent* inference route through your own APIM: create an **Admin-connected model** connection (Manage → Resource details → Admin-connected models → Add → Azure API Management), give the gateway **Base URL** (base path only — Foundry appends `chat/completions`), auth by APIM **subscription key** or **Managed Identity** (with `validate-azure-ad-token` policy in APIM). The agent's model name then becomes **`<connection-name>/<model-name>`**. Roles: **Foundry User** on the project, **Contributor** on the resource group. SDK **`azure-ai-projects` ≥ 2.0.0**. **Limits: "Only prompt agents in the Agent SDK support this feature. The Response API isn't supported at present."** Supported tools include Functions and MCP. Bicep connection templates in `foundry-samples/infrastructure/infrastructure-setup-bicep/01-connections/`. Updated 2026-08-28. |
| Import a Microsoft Foundry API (APIM) | https://learn.microsoft.com/en-us/azure/api-management/azure-ai-foundry-api | Client-compatibility modes when importing Foundry into APIM: **Azure OpenAI** (`/openai/deployments/<dep>/chat/completions`), **Azure AI** (`/models` — deployment in the body), **Azure OpenAI v1** (`openai/v1/<model>/chat/completions`). APIM auto-creates a system-assigned identity, a backend and `set-backend-service`. Test console injects **`Ocp-Apim-Subscription-Key`**. Updated 2026-06-25. |
| Enforce token limits for models | https://learn.microsoft.com/en-us/azure/foundry/control-plane/how-to-enforce-limits-models | Per-project TPM + total-token quota; **429** over TPM, **403** over quota; set in Manage → AI Gateway → Token management. Says to test "by using the project's gateway URL and key". Updated 2026-08-13. |

## Voice Live

| Page | URL | Taken from it |
|---|---|---|
| How to use the Voice Live API | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-how-to | WebSocket endpoint **`wss://<resource>.services.ai.azure.com/voice-live/realtime?api-version=2026-04-10`** (older resources: `.cognitiveservices.azure.com`); agent mode uses `agent_id`/`project_id` query params in place of `model`. Entra scope **`https://ai.azure.com/.default`** (legacy `https://cognitiveservices.azure.com/.default`); roles **Cognitive Services User** + **Foundry User** (renamed from Azure AI User). `session.update` shape; `azure_semantic_vad` / `azure_semantic_vad_multilingual`; `interrupt_response` (barge-in, default true); `remove_filler_words`; `input_audio_echo_cancellation`; **Live-Reference AEC requires api-version `2026-07-15`**. **`instructions` is NOT supported with a custom agent.** Tip: prefer WebRTC for browser clients. Updated 2026-08-18. |
| Voice Live with WebRTC | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-webrtc | **Public preview.** Control-channel endpoint **`/voice-live/realtime/calls`**, sample uses `api-version=2026-01-01-preview`. Three channels: WS control, WebRTC RTP media, data channel `voice-live-events`. `rtc.call.sdp.create` → `rtc.call.sdp.created`; `rtc.call.error`. **"Function and tool call events are routed to the control WebSocket so they can reach your backend for processing"** — the basis for the §3.4 design. Updated 2026-06-28. |
| Quickstart: Voice Agent with Foundry Agent Service (new) | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-agents-quickstart | Agent attachment via **`agent_name` + `project_name`** (+ optional `agent_version`, `conversation_id`, `foundry_resource_override`, `authentication_identity_client_id`) on `azure.ai.voicelive.aio.connect(...)`; sample `api_version="2026-01-01-preview"`. **Entra only — key auth unsupported in agent mode.** |
| Voice Live API overview | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live | Supported models incl. `gpt-5.4`, `gpt-5.2`, `gpt-5`, `gpt-realtime-1.5`, `azure-realtime`; pricing tiers pro/basic/lite; token estimates (~10 tok/s input audio, ~20 tok/s output). Updated 2026-08-26. |
| Voice Live API reference 2026-06-01-preview | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-api-reference-2026-06-01-preview | Located but not read in full; noted because it is a **third** api-version alongside `2026-04-10` and `2026-01-01-preview`. |
| Text to speech REST API | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech | **`POST {endpoint}/cognitiveservices/v1`**, body is **SSML**. Required headers: `Authorization`, `Content-Type: application/ssml+xml`, **`X-Microsoft-OutputFormat`**, `User-Agent`. Streaming format used here: **`audio-24khz-48kbitrate-mono-mp3`**. Audio is truncated at 10 minutes. `415` means the content type was wrong. Doc dated 2026-05-21, read 2026-09-15 (spec 008). |
| Speech: Microsoft Entra authentication | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-configure-azure-ad-auth | **The token is not a plain bearer token**: the header value is **`Bearer aad#{resourceId}#{entraToken}`**, with the `aad#` prefix and `#` separator. Scope **`https://cognitiveservices.azure.com/.default`** (note: *not* the `https://ai.azure.com/.default` Voice Live uses). Requires a **custom subdomain** host `https://{name}.cognitiveservices.azure.com`, which cannot be changed once set. Role: **Cognitive Services Speech User** (or Speech Contributor). Doc dated 2026-06-06, read 2026-09-15 (spec 008). |
| Language and voice support (TTS) | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts | Voice short names used as defaults: **`en-US-AvaMultilingualNeural`**, **`pt-BR-ThalitaMultilingualNeural`**. Read 2026-09-15 (spec 008). |
| Voice Live session configuration (spec 012) | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-webrtc | **The session object rides inside `rtc.call.sdp.create`**, alongside `sdp_offer` — the sample sends `session: { modalities, instructions, voice, turn_detection }` with the offer. After negotiation the control channel stays open for `session.update`. Read 2026-09-15. |
| Voice Live session properties | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live-how-to | `voice` = `{ name, type: azure-standard \| azure-custom, temperature?, rate? }`; `turn_detection.type` `azure_semantic_vad` / `azure_semantic_vad_multilingual`, and **`interrupt_response` (barge-in) exists only on those types** — the default is `server_vad`; `input_audio_noise_reduction: { type: azure_deep_noise_suppression }`; `input_audio_transcription: { model: azure-speech, language }`; **`instructions` is not supported with a custom agent**; HD voices are region-limited to a list that includes `eastus`. Read 2026-09-15. |

> **Verified on the wire, 2026-09-15.** A probe against the reference project's own resource, over
> `/voice-live/realtime` with the app's attachment parameters, answered:
> `session.created` → `modalities ['audio','text']`, `voice en-US-AvaNeural`,
> `turn_detection server_vad`; and after sending the app's session object,
> `session.updated` → `voice pt-BR-ThalitaMultilingualNeural`,
> `turn_detection azure_semantic_vad_multilingual`. **An agent attachment does negotiate audio, and
> the configuration is accepted as sent.**

> **pt-BR voices accepted by the reference project (probed 2026-09-15).** Every one of
> `pt-BR-Luana:MAI-Voice-2-Flash`, `pt-BR-Caio:MAI-Voice-2-Flash`,
> `pt-BR-Thalita:DragonHDLatestNeural`, `pt-BR-Macerio:DragonHDLatestNeural`,
> `pt-BR-Pedro:MAI-Voice-2`, `pt-BR-FranciscaNeural` and `pt-BR-ThalitaMultilingualNeural` came
> back echoed in `session.updated`. **Accepted is not the same as good**: which one sounds least
> synthetic is a listening test, and this repository does not claim to have run one.

> **The listening test, run 2026-09-16 (spec 016).** `pt-BR-Luana:MAI-Voice-2-Flash` was judged not
> good enough in Portuguese by this project's author, listening to real sessions, and the default
> moved to **`pt-BR-Thalita:DragonHDLatestNeural`** — the HD tier, accepting slower first audio for
> naturalness. This is a judgement by ear, recorded as one: no measurement of latency was taken,
> and no claim is made about any other locale.
>
> **HD verified on the wire, 2026-09-16 (spec 016 AC7).** A live session against this project's
> own resource (`ai-admin2354ai223634534338`, eastus2) over `/voice-live/realtime`,
> `api-version=2026-04-10`, sending the app's own `session.update`: `session.created` came back
> `voice en-US-AvaNeural`, and `session.updated` echoed
> **`pt-BR-Thalita:DragonHDLatestNeural` / `azure-standard`** with `modalities ["audio","text"]` —
> then the turn produced `response.audio.delta` frames. So the HD tier is **served and rendered**
> here, not merely accepted, despite the how-to's region list naming `eastus`. Recorded in
> `ai/tests/fixtures/recorded/voice-live-preamble-20260916.jsonl`.
>
> The echoed `voice` object also carries the fields this app does not set — `temperature`, `rate`,
> `pitch`, `style`, `locale`, `prefer_locales`, `custom_lexicon_url`, all `null`. Useful to know
> they exist on `azure-standard`; none is configured by this repo.

> **The preamble, observed 2026-09-16 (spec 016 AC3/AC4).** With the narration rule in agent
> version 6, `gpt-5.5` speaks **before** the function call in both modalities: `text_delta` at
> index 93 vs. the first function call at 112 in the Responses recording, and
> `response.audio_transcript.delta` at 10 vs. `response.function_call_arguments.done` at 30 over
> the voice control channel. Two things worth writing down because they were not asked for:
> the model narrates **once per leg** rather than once per turn (leg 1 covered two calls with one
> sentence; leg 2 opened with *"Encontrei indícios do adversário; vou checar uma fonte adicional
> para confirmar a data da partida."*), which is better for voice than what the instruction asked
> for — every silence gets covered. And the sentences came out in Portuguese without the rule
> naming a language beyond "the one you are answering in".

> **The session configuration is doc-shaped, not wire-verified.** The two rows above describe what
> the documentation says. The committed voice fixtures were recorded *before* this configuration
> existed, so the replay proves this repository's end of it and not Foundry's acceptance (§5).

> **Not verified against a live resource.** The three rows above are what the documentation says.
> No request has been made from this repository to a real Speech resource, so nothing here claims
> the reference project's own Foundry resource answers on that host — `SPEECH_ENDPOINT` is
> configuration for exactly that reason (§5).

> **⚠ Correction recorded (2026-09-04).** An earlier draft of `PLAN.md` claimed that *all* agent and
> model traffic routes through the project AI Gateway. That is **wrong**. The project-level AI Gateway
> governs **direct model calls**; Foundry Agent Service does **not** send its internal inference through
> it. Routing *agent* inference through your own APIM requires the **bring-your-own-model** connection
> above. Corroborating Q&A (a Microsoft moderator answer, not normative docs, so treated as a signal
> rather than a citation): https://learn.microsoft.com/en-za/answers/questions/5777255/ — verify against
> live behaviour in spec 002 and record the result here.

> **Observed in the reference environment (2026-09-04, from the Foundry portal).** Resource
> `foundry-analytics-demo`, project `proj-default`, region `eastus`. Project AI Gateway
> `ai-gateway-foundry-analytics-demo` (Basic v2) is enabled for the project — this is the gateway
> that governs *direct model calls*. Separately, an Admin-connected model connection named
> **`foundry-analytics-demo`** of type *Azure API Management* exposes one model, **`gpt-4o`** — this
> is the BYOM path that governs *agent* inference. Agent model name therefore
> `foundry-analytics-demo/gpt-4o`. Portal observation, not documentation; re-verify before relying
> on it.

> ### Spike findings — observed 2026-09-04 against `proj-default`
>
> Run: `ai/scripts/spike.py`, agent `spike-byom` v1, model `foundry-analytics-demo/gpt-4o`.
>
> **O-3 — ANSWERED: `require_approval: "never"` is accepted.** The Microsoft Learn MCP server was
> declared with `require_approval: never` and Foundry listed its tools with **no approval round
> trip** — no `mcp_approval_request` event of any kind. The docs' consistent use of `"always"` is a
> convention, not a requirement. The BFF does not need auto-approval logic for a public,
> unauthenticated, read-only MCP server.
>
> **O-1 — PARTIAL.** Event types observed before the run failed, in arrival order:
> `response.created` → `response.in_progress` → `response.output_item.added` →
> `response.mcp_list_tools.in_progress` → `response.mcp_list_tools.completed`.
> Text, reasoning and function-call event names are still unobserved; the run died at the model call.
>
> **O-8 — STILL INCONCLUSIVE, but not for the reason we feared.** The stream started normally and the
> MCP tool ran; the failure came at the model call:
> `APIError: Resource not found ModelGateway response: {'error': {'code': '404'}}`.
> That is a *configuration* fault in the reference environment, not evidence that the Responses API
> cannot drive a BYOM agent. Two stacked causes, both confirmed via ARM:
>
> 1. **The Foundry resource has zero model deployments** (`.../deployments` returns `[]`). The BYOM
>    connection *declares* a model called `gpt-4o`, but APIM's backend is
>    `https://foundry-analytics-demo.services.ai.azure.com/` — the same resource — so the request
>    lands on a deployment that does not exist. The 404 is honest.
> 2. **The connection's Base URL stops one segment short.** It is
>    `https://ai-gateway-foundry-analytics-demo.azure-api.net/foundry-analytics-demo`, and Foundry
>    appends `chat/completions`, producing `…/foundry-analytics-demo/chat/completions`. APIM proxies
>    `/*` straight through, so the backend receives `/chat/completions` — not a valid Azure OpenAI
>    route. It should end at `/openai/v1`.
>
> The APIM API also has `subscriptionRequired: true`, and the connection's `authType` is `ApiKey`,
> so the subscription key must be the one on that API's product.
>
> **O-9 — untestable here.** No reasoning model is reachable, so there is nothing to summarise.

> ### Spike findings — observed 2026-09-15 against `ai-admin2354ai223634534-project`
>
> A second environment, because the first one's BYOM gateway was never finished. Resource
> `ai-admin2354ai223634534338` (`rg-belake-core-lab`, **eastus2**), model **`gpt-5.5`** on a plain
> deployment — *not* through the gateway, so the BYOM question below stays open. Runs:
> `ai/scripts/spike.py` (agent `spike-byom`, 131 events) and a follow-up probe (agent
> `spike-reasoning`, 310 events). Both captures are committed, redacted, under
> [`ai/tests/fixtures/recorded/`](../ai/tests/fixtures/recorded/).
>
> **O-8 — ANSWERED: yes.** `responses.create(stream=True)` with an `agent_reference` drives a prompt
> agent end to end: MCP tools listed and called, function calls emitted and answered, text streamed,
> `response.completed` with usage. The BYOM page's "The Response API isn't supported at present"
> does **not** constrain this hop. *Caveat, stated because it matters:* this ran on a plain
> deployment. Whether the same holds with `<connection>/<model>` is **still unverified** — see the
> gateway note above.
>
> **O-3 — CONFIRMED again.** `require_approval: never` accepted; zero approval events in 441
> recorded events across both runs.
>
> **O-1 — ANSWERED in full.** 21 distinct event types, mapped and tested in
> `ai/harness/prompt_agent/events.py`; the table is in
> [how-it-works/streaming-events.md](how-it-works/streaming-events.md). Three of them contradicted a
> reasonable inference, and are documented there rather than quietly fixed:
> `response.mcp_call.completed` carries **no `item`** (only `item_id`), so the MCP call must be read
> from `response.output_item.done`; `response.function_call_arguments.done` carries `name: null`;
> and a turn with a function-call round trip contains **two** `response.completed` events, because
> Foundry closes the leg it is waiting on.
>
> **O-9 — ANSWERED: yes, but only from the agent definition.** Reasoning summaries stream as
> `response.reasoning_summary_part.added` → `response.reasoning_summary_text.delta` (×159) →
> `.done` → `_part.done`. The configuration must live on `PromptAgentDefinition.reasoning`; sending
> it per request next to an `agent_reference` is rejected:
>
> ```
> 400 invalid_payload — "Not allowed when agent is specified."  (param: reasoning)
> ```
>
> Without it the model still spends reasoning tokens (410 in the recorded turn) and still emits
> `reasoning` output items, but each carries `summary: []`. Hence the `reasoning:` block in
> `ai/harness/prompt_agent/agent.yaml`. **Not answered:** whether summaries survive the
> `chat/completions` hop to a BYOM model — same caveat as O-8.
>
> **Token accounting.** Both legs bill separately: 1 091 + 17 520 input, 132 + 754 output, 68 + 342
> reasoning. A turn's usage is the sum, not the last leg.

> ### `reasoning.summary: auto` is not enough — observed 2026-09-16
>
> Agent `foundry-live-agent` version 4, model `gpt-5.5`, `reasoning: {summary: auto}` — read back
> from the live service with `AIProjectClient.agents.get()`, so the configuration is confirmed and
> not assumed. A turn answering *"How does this project talk to Microsoft Foundry?"* ran **seven**
> tool-calling legs, emitted a `reasoning` output item on most of them, and produced **no summary
> text at all**: the app's reasoning card was empty for the whole turn.
>
> `auto` leaves the choice to the model, and on a short leg whose only output is a function call it
> chooses not to summarise. The fix is `summary: detailed`, applied as **version 5** and verified the
> same way. `concise` is not an alternative on this family — the GPT-5 series rejects it (see the
> reasoning-models row in the table below).
>
> The consequence for the app is recorded in spec 015: a model that declines to summarise is a
> normal state, not a misconfiguration, so the UI must stay useful without a summary.

> **Voice Live api-version status — RESOLVED 2026-09-15, and the answer is "two".** Probed with
> `ai/scripts/spike_voice.py` against `ai-admin2354ai223634534338` (eastus2):
>
> | Endpoint | 2026-01-01-preview | 2026-04-10 | 2026-06-01-preview | 2026-07-15 |
> |---|---|---|---|---|
> | `/voice-live/realtime` (WebSocket) | ✅ | ✅ | ✅ | ✅ |
> | `/voice-live/realtime/calls` (WebRTC control) | ✅ | 404 | 401 | 404 |
>
> The WebRTC route exists on **one** version. `.env.example` therefore carries
> `VOICELIVE_WEBRTC_API_VERSION` **and** `VOICELIVE_WS_API_VERSION`; a single shared value silently
> breaks whichever path it was not chosen for.

> ### Voice Live findings — observed 2026-09-15
>
> **O-2 — ANSWERED: yes, agent mode works over WebRTC.** The full handshake completed against the
> live service and a real Chromium SDP offer: `rtc.call.sdp.create` → `rtc.call.sdp.created` with an
> SDP answer carrying an audio m-line and ICE candidates. The PLAN §4.4 design stands and the
> server-side audio-relay fallback was not needed. Recorded in
> `ai/tests/fixtures/recorded/voice-live-webrtc-handshake-20260915.jsonl`.
>
> **The attachment parameters in the quickstart are wrong.** Documented: `agent_name` +
> `project_name`. The service answers `"Missing required agent project name"`. The working pair is
> `agent_name` + **`agent_project_name`** (hyphenated `agent-name` / `agent-project-name` also
> works). `agent_id` + `project_id` is refused: *"Classic foundry agent is not supported in API
> version 2026-04-10 and above. Use API version 2025-10-01 or 2026-01-01-preview for classic foundry
> agent, or migrate to the new foundry agent."*
>
> **The SDP field is `sdp_offer`.** `sdp`, `offer`, `call.sdp`, `session_description` and the other
> obvious spellings all return `rtc.call.error` / `missing_sdp` — *"SDP offer is required"*, which
> reads as a missing value rather than a wrong key.
>
> **Function calls reach the control channel, complete.** `response.function_call_arguments.done`
> carries `name`, `call_id` and `arguments` **together** — better shaped than the Responses API,
> which sends `name: null`. The round trip was completed end to end using this repository's own
> registry: `conversation.item.create` (`function_call_output`) followed by `response.create`, and
> the agent then answered. Without the `response.create` the agent stays silent. Recorded in
> `voice-live-tool-call-20260915.jsonl`. MCP works in voice too (`mcp_list_tools.*`).
>
> **Session defaults.** `voice: en-US-AvaNeural` (`azure-standard`); `turn_detection: server_vad`
> with **`interrupt_response: true`** — barge-in is on without being asked for.
>
> **O-5 — region.** eastus2 serves Voice Live for this resource.

## Models

| Page | URL | Taken from it |
|---|---|---|
| Azure OpenAI reasoning models — GPT-6 Astra and GPT-5 | https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/reasoning | Reasoning summaries via **`reasoning={"effort": …, "summary": "auto"}`** — `auto`/`concise`/`detailed`, **GPT-5 series do not support `concise`**. `reasoning_effort`: `none`/`minimal`/`low`/`medium`/`high`/`xhigh`/`max`. Current families: `gpt-6-astra`, `gpt-5.6-{sol,terra,luna}`, `gpt-5.5`, `gpt-5.4`(+mini/nano/pro), `gpt-5.3-codex`, `gpt-5.2`, `gpt-5.1`, `gpt-5`. **`gpt-5.4` and `gpt-5.5` support interleaved thinking on the Responses API.** **Use the Responses API for tool calling with reasoning models** — Chat Completions requires `reasoning_effort="none"` alongside `tools` on GPT-5.6+. Updated 2026-09-04. |

## Provisioning (azd / Bicep)

| Page | URL | Taken from it |
|---|---|---|
| azure.yaml reference for hosted agents | https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/azure-yaml-reference | The `azure.ai.project` + `azure.ai.agent` service model that replaces `agent.yaml` (located; to be read in full for Phase 4). |
| Microsoft Foundry agent extension for azd | https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/extensions/azure-ai-foundry-extension | `azd ai agent init` / `azd up` / `azd down`; Bicep is **generated from `azure.yaml`** and can be **ejected to `./infra/`**; Terraform via `infra.provider: terraform`. |
| Quickstart: deploy a Foundry resource by using Bicep | https://learn.microsoft.com/en-us/azure/foundry/how-to/create-resource-template | Located for `infra/main.bicep`; to be read in full during Phase 1. |

## External

| Resource | URL | Notes |
|---|---|---|
| Microsoft Learn MCP Server | https://learn.microsoft.com/en-us/training/support/mcp | Public remote MCP endpoint **`https://learn.microsoft.com/api/mcp`**, Streamable HTTP, **no API key or account required**, free. Used as the repo's remote MCP tool. |
| AgentSchema specification | https://microsoft.github.io/AgentSchema/ | Open standard behind the now-deprecated `agent.yaml`. Context for the §3.1 decision. |
| foundry-samples — hosted agents | https://github.com/microsoft-foundry/foundry-samples/tree/main/samples/python/hosted-agents | Agent Framework / LangGraph / custom-code hosted agent samples, for the Phase 4 LangGraph harness. |
| voicelive-samples | https://github.com/microsoft-foundry/voicelive-samples | JS samples incl. Live-Reference AEC and avatar. |
| **Tavily Search API — `POST /search`** | https://docs.tavily.com/documentation/api-reference/endpoint/search | The `search_web` tool (spec 013). Endpoint **`https://api.tavily.com/search`**; auth header **`Authorization: Bearer tvly-…`** (a plain bearer, unlike Speech's `aad#` form). Request fields used: `query`, `max_results` (0–20, default 10), `search_depth` (`basic` = 1 credit, `advanced` = 2). Response: `{query, results: [{title, url, content, score, published_date?, raw_content?}], response_time, request_id}`. Status codes: **401** unauthorized, **429** rate limited (with `Retry-After`), **432** plan limit, **433** pay-as-you-go limit, 400/422 bad request, 500 server error. `include_answer` exists and is deliberately **not** used — see the spec. Read 2026-09-15. |

---

## Versions this repo pins

| Thing | Value | Source |
|---|---|---|
| Python SDK | `azure-ai-projects>=2.3.0` | prompt-agent quickstart |
| Agents REST api-version | `v1` | prompt-agent quickstart |
| Responses route | `{project_endpoint}/openai/v1/responses` | Responses API quickstart |
| Entra token scope | `https://ai.azure.com/.default` | prompt-agent quickstart + Voice Live how-to |
| Model deployment | `gpt-5.4` (configurable) | reasoning models page |
| Model name via BYOM gateway | `<connection-name>/<model-name>` | bring-your-own-model page |
| APIM gateway base URL | base path only — Foundry appends `chat/completions` | bring-your-own-model page |
| Voice Live api-version (WebRTC `/calls`) | **`2026-01-01-preview` — the only one that serves it** | observed 2026-09-15 |
| Voice Live api-version (plain WebSocket) | `2026-04-10` | observed 2026-09-15 |
| Voice Live agent attachment | `agent_name` + **`agent_project_name`** (not `project_name`) | observed 2026-09-15 |
| Learn MCP server | `https://learn.microsoft.com/api/mcp` | Microsoft Learn MCP docs |
| Web search endpoint | `https://api.tavily.com/search`, `search_depth: basic`, `max_results: 5`, 10s timeout | Tavily `/search` reference |
| Python | 3.12 | project decision |
