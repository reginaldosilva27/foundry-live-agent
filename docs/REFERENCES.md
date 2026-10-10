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
| Hosted agents | https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/hosted-agents | Container contract; Responses / Invocations / Invocations-WS / Activity / A2A protocols; per-session VM-isolated sandbox; `$HOME` + `/files` persistence; **idle timeout 2–60 min, default 15** (was written 5–60 here until 2026-09-16; the doc says 2–60); session deleted after 30 days; immutable versions; sandbox sizes (0.5/1/2 vCPU); LangGraph named as a supported framework; region list incl. Brazil South. Updated 2026-08-27. |
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
| Voice Live: HD (Dragon HD) voices | https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices | Naming is **`voicename:basemodel:version`**, e.g. `pt-BR-Thalita:DragonHDLatestNeural` — persona and original locale before the colon, `LatestNeural` to track the latest base model. Two HD families: **DragonHD** (30+ fine-tuned voices) and **DragonHDOmni** (700+, multilingual with automatic language detection, `…:DragonHDOmniLatestNeural`), plus DragonHD **Flash** (zh-CN/en-US only). DragonHD supports `temperature` and a subset of SSML; `<prosody>` and `<emphasis>` are **not** supported. Latency < 300 ms (same band as non-HD; Azure OpenAI HD voices are > 500 ms). **The published DragonHD table lists no `pt-BR` voice** — see the observation below. Read 2026-09-16 (spec 017). |
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

> **What actually produces the voice, read 2026-09-16.** The Voice Live overview's model table
> settles it: every `gpt-5.x` row reads *"+ audio input through Azure speech to text + audio output
> through **Azure text to speech voices** including custom voice"*. So this project's spoken turn is
> a **cascade** — Azure STT → `gpt-5.5` → Azure TTS — and the voice is a TTS persona, not the model
> speaking. Only `azure-realtime` (with its dedicated `azure-realtime-native` voices) and the
> `gpt-realtime*` family generate audio natively. The same page notes `gpt-5.5` *"is supported and
> tested with Voice Live but isn't pre-deployed"* — it runs as a deployment in the Foundry resource,
> which is what this project does.
>
> **Consequence worth stating:** anything unpleasant about *what* is said — a URL read slash by
> slash — is the model's text, not the voice's rendering, and no voice change fixes it (spec 017).

> **A gap between the doc and the wire (2026-09-16, unresolved).** The HD voices page lists 28
> DragonHD voices and **none of them is `pt-BR`**; the locales are en-US, de-DE, es-ES, fr-FR, ja-JP
> and zh-CN. Yet `pt-BR-Thalita:DragonHDLatestNeural` is echoed by `session.updated` and produces
> `response.audio.delta` frames on this project's resource. Three readings are possible and this
> repository does not pick one without evidence: the table is incomplete, the service resolves the
> persona through a different HD family, or it falls back silently to a non-HD voice. **A silent
> fallback would be invisible**, which is precisely why it is written down. `DragonHDOmni`
> (`pt-BR-Thalita:DragonHDOmniLatestNeural`) is the documented HD family that does cover pt-BR and
> is the obvious thing to probe next.

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

> **The agent cannot perceive the modality — observed 2026-09-16 (spec 017).** Asked over a real
> audio turn (synthesized speech into `input_audio_buffer.append`, transcribed by the service,
> answered as audio): *"nesta conversa você está me ouvindo por voz, ou trocando texto escrito
> comigo?"* → **"Estou trocando texto escrito com você."** Twice, once with a text item driving the
> session and once with real audio. This follows from the cascade above — the model's input is a
> transcript and its output is text — and it kills any instruction conditioned on the modality.
>
> **What works instead:** one `conversation.item.create` with `role: "system"`, sent when the
> session opens. Accepted by Voice Live **with a custom agent** (where `instructions` is not), and
> the spoken answer then stops reading URLs. The A/B is committed:
> `voice-live-no-urls-20260916.jsonl` (with the item) against
> `voice-live-urls-spoken-20260916.jsonl` (same agent version 8, same question, item removed).

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

## Hosted agents — spec 018, read and verified 2026-09-16

The docs read for this spec, then what the live service actually did. Where the two disagree, the
observation wins and says so (§10). Everything below was produced against
`foundry-live-agent-hosted` version 1, project `ai-admin2354ai223634534-project` (eastus2).

### Documentation

| Source | What it settles |
|---|---|
| [Hosted agents](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/hosted-agents) | Three sandbox sizes (0.5/1 · 1/2 · 2/4 vCPU/GiB); billing is CPU+memory across **active sessions**, so oversizing multiplies by concurrency; idle timeout 2–60 min, 15 default; Responses endpoint shape; dedicated Entra agent identity per agent; "don't put secrets in container images or environment variables"; 31 regions incl. East US 2 and Brazil South. Updated 2026-09-14. |
| [LangGraph hosted agents](https://learn.microsoft.com/en-us/azure/foundry/how-to/develop/langchain-hosted-agents) | `pip install -U "langchain-azure-ai[hosting]>=1.2.9"`; `ResponsesHostServer(graph).run(port=...)`, default port 8088, `PORT` honoured; **no checkpointer → the host replays Responses history into the graph**, with one → current input only, keyed by conversation thread; interrupts surface as `function_call` named `__hosted_agent_adapter_interrupt__`; platform injects `FOUNDRY_PROJECT_ENDPOINT`, `FOUNDRY_MODEL_NAME`, `APPLICATIONINSIGHTS_CONNECTION_STRING`; deploy needs Docker and **Foundry Project Manager**. Updated 2026-08-31. |
| [Author azure.yaml](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/author-azure-yaml) · [azure.yaml reference](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/azure-yaml-reference) | `azure.ai.project` + `azure.ai.agent` services; `protocols: [{protocol: responses, version: 2.0.0}]`; `container.resources.cpu` `"0.25"`–`"4.0"`, `memory` `0.5Gi`–`8.0Gi`; **`FOUNDRY_` and `AGENT_` are reserved prefixes** and `FOUNDRY_PROJECT_ENDPOINT` must not be declared in `env`; model deployment passed as `MICROSOFT_FOUNDRY_MODEL_DEPLOYMENT_NAME`; `azure.ai.agents` ≥ 1.0.0-beta.8, `azure.ai.projects` ≥ 1.0.0-beta.4, azd ≥ 1.27.1. |
| [azd azure.yaml schema](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/azd-schema) | `docker.path` and `docker.context` are valid on an `azure.ai.agent` service — which is what lets the build context be `ai/` while the Dockerfile sits with the agent code. |
| [Hosted agent permissions](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/hosted-agent-permissions) | "The agent has implicit access to core capabilities within its own project… No explicit role assignment is needed for the standard case." **Contradicted live — see below.** `Foundry User` at project scope is the least-privilege role that grants model inferencing. |
| [Set up a Key Vault connection](https://learn.microsoft.com/en-us/azure/foundry/how-to/set-up-key-vault-connection) | A Foundry **Key Vault connection** is a BYO vault for Foundry's *own* connection secrets: **one per Foundry resource**, creatable only on a resource with **no existing connections**. It is not a channel for an application secret. Spec 018's AC7 was written from this page's title and amended once the page was read. |

### Two documents disagreeing with each other

| Question | Concept doc | `azure.yaml` reference | What we do |
|---|---|---|---|
| Sandbox sizes | three fixed combinations | `cpu` `"0.25"`–`"4.0"`, `memory` `0.5Gi`–`8.0Gi` | Enforce the three in `agent_spec.py`. 1 vCPU / 2 GiB satisfies both. |
| Model deployment variable | LangGraph guide's code reads `FOUNDRY_MODEL_NAME` | reserves `FOUNDRY_*` and passes `MICROSOFT_FOUNDRY_MODEL_DEPLOYMENT_NAME` | `agent/host.py` reads **both**, platform value first, agent definition last. |

### Verified against the live service

| Finding | Evidence |
|---|---|
| **TWO identities need a role, not one.** Granting only the agent identity made turns succeed for ~30 minutes and then fail again with the generic `401 — Principal does not have access to API/Operation`. The **project's managed identity had no role on the account at all**: the project proxies inference to the account deployment with its own identity, and the permissions doc says that assignment "might be created automatically when the project is created, depending on the permissions of the user creating it" — here it was not. Granting it `Foundry User` at **account** scope fixed it for good. | observed 2026-09-16, twice |
| **The agent identity does NOT have implicit model access.** First turn failed: `401 PermissionDenied — The principal <agent-oid> lacks the required data action Microsoft.CognitiveServices/accounts/OpenAI/deployments/chat/completions/action`. Fixed by granting **Foundry User** at the **project** scope to the agent identity. Because that identity does not exist until after the first deploy, the real sequence is deploy → assign → wait → works. | `langgraph-hosted-*-20260916.jsonl`, and the failing runs that preceded them |
| **The Responses endpoint requires `?api-version=v1`.** The documented URL shape omits it; without it the service answers `400 BadRequest — Missing required query parameter: api-version`. `azd deploy` prints the URL **with** it. | observed 2026-09-16 |
| **`azure.yaml` needs `infra: provider: microsoft.foundry`.** Without it azd falls back to its bicep provider and fails looking for `infra/main.bicep`. The value is what `azd ai agent init` writes itself. | generated by the extension, 2026-09-16 |
| **`AZURE_AI_PROJECT_ID` must be set in the azd environment** for an existing Foundry project — `azd provision` refuses without it. Not in the `azure.yaml` reference. | observed 2026-09-16 |
| **No `idle timeout` key exists in `azure.yaml`.** The timeout is configurable per agent version (2–60 min, 15 default), but the `azure.ai.agent` field reference documents no field for it. **Open question O-18-1**; `build_hosted_config.py` states the value in a comment rather than inventing a key. | azure.yaml reference, 2026-09-16 |
| **The container is the MCP client, and Learn exposes three tools**: `microsoft_docs_search`, `microsoft_code_sample_search`, `microsoft_docs_fetch`. This harness therefore emits **no `mcp_call`** at all. | `langgraph-hosted-learn-20260916.jsonl` |
| **A `function_call` here is a report, not a request.** `function_call` and `function_call_output` arrive with the same `call_id` in one stream: the container already ran the tool. `function_call_output` carries **no `name`**, so the normaliser must keep a call_id → name map. | same fixture |
| **One `response.completed` per turn**, not two. No usage summing, no held-back `done` — the prompt agent needs both. | both fixtures |
| **`response.completed` carries `usage: null`.** The hosted agent reports no tokens. The contract always permitted an absent `usage`; the cost line must render "not reported", never zero. | both fixtures |
| **No reasoning summaries.** `reasoning` is a prompt-agent *definition* field; this loop produces none. | both fixtures |
| **Voice Live attaches to a hosted agent.** Same `agent_name` + `agent_project_name` query; `session.created` reports the hosted agent as its `model` and echoes its definition, and `instructions` is `null` as with any custom agent. | `langgraph-hosted-voice-20260916.jsonl` |
| **Hosted traces carry no `gen_ai.response.id`.** Queried live: zero spans have it. They key on `microsoft.session.id`, which equals the response's `agent_session_id` — 29 spans matched the recorded turn that way. Spans include `invoke_agent LangGraph`, `invoke_agent tools_condition`, `execute_tool microsoft_docs_search`, `chat gpt-5.5` and `POST /api/mcp`. **The trace panel's join (spec 005) finds nothing for this harness**; fixing it means putting `agent_session_id` on `trace_ids`, which is an `AgentEvent` change and needs its own spec (§9). | App Insights `ai-admin2354ai223634534-project-appinsights-2442`, 2026-09-16 |
| **A hosted agent traces MORE than a prompt agent.** A function tool the BFF runs leaves no span (§8 visible in telemetry); the container's `execute_tool get_current_datetime` is a span, because the container is instrumented. | same query |
| **`pip` 25.0.1 cannot resolve `langchain-azure-ai`** — `InvalidVersion: Invalid version: 'hosting'`, with or without the extra, pinned or not. pip 26 resolves it cleanly; the Dockerfile upgrades pip first. | reproduced in a clean `python:3.12-slim`, 2026-09-16 |
| **`azd` can reuse the `az` CLI credential**: `azd config set auth.useAzCliAuth true`, avoiding a separate interactive `azd auth login`. | observed 2026-09-16 |

## Listing the project's agents — spec 019, read and verified 2026-09-16

The agents screen reads the project rather than a list written in this repository. What that costs,
and what it needs, was checked against the live project **before** the screen was designed — spec
018's lesson (§10).

### Documentation

| Source | What it settles |
|---|---|
| [Manage hosted agents](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/manage-hosted-agent) | `project_client.agents.list()` · `agents.get(name)` · `agents.list_versions(name)` on `azure-ai-projects>=2.3.0`; REST `GET {project_endpoint}/agents?api-version=v1`, and `az rest` needs `--resource https://ai.azure.com`; version statuses `creating` · `active` · `failed` · `deleting` · `deleted`, provisioning typically 2–5 minutes; an agent can be **disabled** (endpoint offline, versions intact); an agent endpoint serves **one** version at 100% — traffic splitting is unsupported; draft versions are `draft-{timestamp}`, excluded unless `include_drafts=true`. |
| [agent.yaml reference](https://learn.microsoft.com/en-us/azure/foundry/agents/concepts/agent-yaml-reference) | Definition kinds are `prompt`, `hosted`, `workflow`. |

### Verified against the live service

| Finding | Evidence |
|---|---|
| **`kind` is in the listing.** `data[].versions.latest.definition.kind` comes back with the list, so the screen needs no second call per agent. Spec 019's AC2 explicitly allowed for one and it is not needed. | `backend/tests/fixtures/agents-listing-20260916.json`, 10 agents |
| **`versions` carries only `latest`.** Which matches the documented one-version-per-endpoint rule, and is why the row reports the served version rather than a version list. | same fixture |
| **A hosted agent's definition carries no `model`.** It has `cpu`, `memory`, `container_configuration` and `environment_variables`; the deployment name is inside `environment_variables.MICROSOFT_FOUNDRY_MODEL_DEPLOYMENT_NAME`. A prompt agent's definition has `model` directly. `app/agents.py` reads both and reports `""` rather than inventing one. | same fixture |
| **The audience is `https://ai.azure.com`, not `https://cognitiveservices.azure.com`.** The same URL with the latter answers `401 Unauthorized. Access token is missing, invalid, audience is incorrect (https://ai.azure.com), or have expired.` | observed 2026-09-16 |
| **Listing needs `Foundry User`.** Read from the live role definitions rather than assumed: `Foundry User` and `Foundry Project Manager` grant the **same** data action, `Microsoft.CognitiveServices/*`, which covers the agents data plane; they differ only on the control plane (Project Manager adds `accounts/projects/*` and `roleAssignments/write`). So listing — a data-plane read — needs the lesser of the two, and spec 019's decision 10 expectation holds. **Not tested with an identity holding only `Foundry User`**: the signed-in identity here has both, and the conclusion is read from the role definitions, not from a denial. | `az role definition list`, 2026-09-16 |

## What the agents listing actually returns — spec 030, read from the recording 2026-09-19

Spec 030 asked whether the Agents v2 read returns an agent's *definition* — instructions, tool
schemas, the reasoning block — for agents this project did not create. The answer was already in
`backend/tests/fixtures/agents-listing-20260916.json`, the real listing of a real project with ten
agents in it, eight of them nothing to do with this repository.

| Finding | Evidence |
|---|---|
| **The listing returns the whole definition.** A prompt agent's `versions.latest.definition` carries `instructions` · `model` · `tools` · `reasoning`. No per-agent call is needed — the same thing spec 019 found about `kind`, holding for everything else. | all 9 prompt agents in the fixture |
| **A hosted agent's definition has none of those.** It carries `container_configuration.image` · `cpu` · `memory` · `protocol_versions` · `environment_variables`. A hosted agent *is* a container, and the screen shows what it is rather than blanks where a prompt agent's fields would be. | `foundry-live-agent-hosted` |
| **Every tool is typed.** Three `function` and one `mcp` on our agent; an MCP tool additionally carries `server_label` · `server_url` · `require_approval`. | `foundry-live-agent` |
| **`reasoning` is reported by 2 of 10.** Absent is the ordinary case, which is why an empty reasoning card is a normal state (spec 015) rather than a misconfiguration. | `foundry-live-agent`, `spike-reasoning` |
| **Instructions come back empty for 5 of 10** — genuinely empty in the project, not redacted; the fixture is redacted by identifier only. So *reported and empty* and *not reported* are two different things the UI must keep apart (§5). | `testagentdemo`, `test-agent`, `globalpowerplataformaagent`, `dataagent`, `DatabricksGenie` |
| **A container's environment reaches the listing**, and holds `KEY_VAULT_URI`. The BFF therefore drops the environment in its projection rather than filtering it at render time: a field the browser never receives cannot leak from it later. | `foundry-live-agent-hosted` |

## What a turn costs — spec 028, read and verified 2026-09-18

The app estimates a turn's cost from token counts and rates the **operator** declares; this
repository ships no prices (§5 — a price compiled in here is a fact with no owner). What had to come
from a doc is not the price but the **arithmetic**: which token classes are billed, and whether the
numbers Foundry reports are breakdowns or additions. Getting that wrong produces a plausible figure
that is quietly double the truth.

### Documentation

| Source | What it settles |
|---|---|
| [Azure OpenAI reasoning models](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/reasoning) | **"Reasoning tokens ... are billed as output tokens."** And: *"Reasoning tokens are billed as output tokens, so a request that thinks longer costs more even when the visible answer is short."* Reported at `output_tokens_details.reasoning_tokens` in the Responses API (`completion_tokens_details.reasoning_tokens` in Chat Completions). Page `ms.date` 2026-08-20, updated 2026-09-16; read 2026-09-18. |

### Verified against this repository's recordings

The doc says reasoning is *billed as* output. Whether it is *counted inside* `output_tokens` or
beside it is the part that decides the formula, and that is measured here rather than assumed.

| Finding | Evidence |
|---|---|
| **`reasoning_tokens` is inside `output_tokens`, and `cached_tokens` is inside `input_tokens`.** Every recorded turn satisfies `total_tokens == input_tokens + output_tokens`, with both details nested one level down. So the estimate prices `output_tokens` (reasoning included) and splits `input_tokens` into cached and fresh — adding either detail on top would bill it twice. | `ai/tests/fixtures/recorded/prompt-agent-turn-20260915.jsonl`: `1091 + 132 = 1223`, `17520 + 754 = 18274`, with `reasoning_tokens` 68 / 342 and `cached_tokens` 0 / 1024 |
| **The stream reports the prompt cache** — it is not spans-only, as spec 028's draft assumed. `input_tokens_details.cached_tokens` arrives in the same `response.completed` payload the normaliser already reads `output_tokens_details` from. This is why spec 028 extends the `usage` event (§9) instead of waiting on Application Insights, which most deployments of this repo do not configure. | same fixtures: cached values of 1024, 3584 and 4096 across recorded turns |
| **The two APIs spell the field differently.** The Responses API sends `input_tokens_details` (plural); Voice Live sends `input_token_details` (singular). Each normaliser reads its own spelling, and each has its own recorded test, because a shared reader would find `None` forever and price every cached token at the full rate without failing. | `prompt-agent-turn-20260915.jsonl` vs `voice-live-preamble-20260916.jsonl` |

## Foundry IQ — spec 049, read 2026-09-20 (nothing built yet)

| Doc | Read |
|---|---|
| [Connect agents to Foundry IQ knowledge bases](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/foundry-iq-connect) | 2026-09-20 |
| [Agentic retrieval overview](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-overview) | 2026-09-20 |
| [Query a knowledge base (retrieve action or MCP)](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve) | 2026-09-20 |
| [Service limits for tiers and SKUs](https://learn.microsoft.com/en-us/azure/search/search-limits-quotas-capacity) | 2026-09-20 |

**Read before the spec was written, which is the point of §10** — and it changed the design. Nothing
here is implemented yet.

### The decision the reading produced

Foundry IQ is reachable **two ways**, and `PLAN.md`'s note implied the wrong one for this repository.

| | As an MCP tool on the agent | As a REST call from the BFF |
|---|---|---|
| Endpoint | `{search}/knowledgebases/{kb}/mcp` | `POST {search}/knowledgebases/{kb}/retrieve` |
| `api-version` | `2026-08-01-preview` | **`2026-04-01` — GA** |
| Executes it | **Foundry** (`mcp_call`) | **our BFF** (`tool_call`/`tool_result`, `executor: "app"`) |
| Auth | a `RemoteTool` project connection created through ARM | `DefaultAzureCredential`, scope `https://search.azure.com/.default` |
| RBAC | 4 assignments across 2 resources | **1 role**, `Search Index Data Reader` |
| Agent definition | gains an MCP tool | **unchanged** |

**Spec 049 takes the REST call.** The MCP route would move retrieval to Foundry's side and delete
one of only two demonstrations of the function-call round trip — which is what
`docs/how-it-works/function-call-round-trip.md` is about. The REST route changes one class behind
the `KnowledgeSource` Protocol that `registry.py:43` was written around, and needs no preview API
and no control-plane write. The MCP shape stays recorded below as the road not taken.

### The route taken — `POST /knowledgebases/{kb}/retrieve`

| Fact | Consequence |
|---|---|
| **`POST {search_endpoint}/knowledgebases/{kb}/retrieve?api-version=2026-04-01` is generally available.** Bearer token, scope `https://search.azure.com/.default`, role **`Search Index Data Reader`**. | The whole of spec 049 needs one endpoint, one scope and one role. No project connection, no ARM write, no preview. |
| **GA is `minimal` and extractive**: semantic reranking and references, but **no LLM query planning and no answer synthesis**. Those need `2026-08-01-preview`. | Spec 049 ships GA and **names what it does not do**, the way `knowledge_tool.py` already refuses to call a keyword matcher semantic search (§5). With a three-document corpus there is little to decompose. |
| Response carries `response` (merged content), `activity` (what was queried) and `references` (for citation). | `references` is what the Sources strip (spec 034) reads. `activity` is a cost-control tool the doc recommends reading; not used yet. |
| `maxRuntimeInSeconds`: min 10, **default 90**, max 600. | A retrieval can take a minute and a half by default. The function-call round trip expires at **10 minutes**, so the default leaves room — but the two numbers should be read together. |
| **Free tier supports agentic retrieval**: 3 knowledge bases, 3 knowledge sources per service, 3 sources per knowledge base, 50 MB storage, one free service per subscription. Free is **absent from the semantic-ranker throttling table**, which starts at Basic. | Spec 049 uses Free. Its limits are stated in the spec rather than discovered later, including that a free service *"might be deleted after extended periods of inactivity"*. |
| **Agentic retrieval has its own billing**: Azure AI Search bills retrieval tokens with a monthly free allowance by default; Azure OpenAI bills separately, but only for query planning and answer synthesis. | On the GA path there is **no Azure OpenAI charge at all**, because neither of those runs. |
| No Bicep path is documented for a knowledge base or a knowledge source. | Same shape as O-4. Provisioning is a documented manual step, not IaC nobody verified (§5). |

### The road not taken — the MCP tool

Recorded because it is the design `PLAN.md` implied, and because a future spec may want it.

| Fact | Consequence |
|---|---|
| **Foundry IQ attaches as an MCP tool**: `type: "mcp"`, `server_label`, `require_approval: "never"`, `allowed_tools: ["knowledge_base_retrieve"]`, `project_connection_id`. | Retrieval becomes **Foundry-executed** (`mcp_call`), and `lookup_knowledge` would go. That is what spec 049 declined. |
| **`knowledge_base_retrieve` is the only supported tool.** Stated explicitly in the doc. | `allowed_tools` is a one-item list, and a spec that assumes more is wrong. |
| **The MCP endpoint is `{search_service_endpoint}/knowledgebases/{kb}/mcp?api-version=2026-08-01-preview`** — a **preview** api-version, and the doc's troubleshooting section calls out using the wrong one as a cause of 400/404. | Preview, like Voice Live's WebRTC endpoint. Pinned in `.env.example` and said out loud, per this file's existing practice. |
| **It needs a project connection created through ARM**, not through the Foundry data plane: `PUT https://management.azure.com/{project_resource_id}/connections/{name}?api-version=2025-10-01-preview`, with `category: "RemoteTool"`, `authType: "ProjectManagedIdentity"`, `audience: "https://search.azure.com/"`. | A second control-plane write, and a second `api-version` on a different plane. The connection — not a key — is how the agent authenticates, so §"zero secrets" holds. |
| **Four role assignments across two resources**: `Foundry Project Manager` on the account to create the connection (`Foundry User` or PM to *use* the tool), `Search Index Data Reader` for the **project's** managed identity on the search service, and — only if the knowledge base names an LLM — `Cognitive Services User` for the **search service's** identity on the account. | Four, against the one the REST route needs. A large part of why spec 049 declined this design. |
| **Prerequisite: an Azure AI Search service with a knowledge base and at least one knowledge source.** Hub-based projects are not supported. | True of both routes. Spec 049 provisions it on the **Free** tier as a documented manual step. |
| **SDK `azure-ai-projects>=2.0.0`**; the tool model is `MCPTool`. | The repo pins `>=2.3.0`, so this is satisfied. |
| **The doc's suggested instructions ask for citations rendered as `【message_idx:search_idx†source_name】`.** | Not Markdown — `Markdown.tsx` would render it literally, and spec 034 builds the Sources strip from **events**, never from prose. **Moot on the route taken**: no instruction goes near the agent, because retrieval happens inside our own function tool. |
| **Citation URLs vary by knowledge source** — a blob source returns the document URL; a search-index source falls back to the knowledge base's MCP endpoint. | Applies to **both** routes, and spec 049's AC2 inherits it: spec 034's "one reader per tool, because the shapes really differ". A URL that is really an endpoint must never render as a source the reader can open. |
| **Per-user filtering exists** via the `x-ms-query-source-authorization` header, supplied per request through `structured_inputs`. | Out of scope for 049: this app has no notion of a user. Recorded because it is the documented answer if that ever changes. |

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
| Hosted agent Responses route | `{project_endpoint}/agents/{name}/endpoint/protocols/openai/responses?api-version=v1` | **observed 2026-09-16** — the doc omits the api-version |
| Hosted agent sandbox | 1 vCPU / 2 GiB, idle 15 min (the default) | stated once in `ai/harness/langgraph/agent.yaml` |
| Hosted agent protocol | `responses`, version `2.0.0` | azure.yaml reference |
| Hosting package | `langchain-azure-ai[hosting]>=1.2.9`, pip **≥ 26** | LangGraph hosted-agents guide + observed 2026-09-16 |
| azd extensions | `azure.ai.agents` ≥ 1.0.0-beta.8, `azure.ai.projects` ≥ 1.0.0-beta.4, azd ≥ 1.27.1 | azure.yaml reference |
| Hosted agent trace join | `microsoft.session.id` == `agent_session_id` (**not** `gen_ai.response.id`) | observed 2026-09-16 |
| Promote a version | `update_details(agent_name, agent_endpoint=...version_selector...)`, one rule at 100% | SDK 2.6.0 typespec 2026-09-19, **accepted by the live service 2026-09-20** |
| Restore an endpoint to tracking the newest | the same call with `agent_version="@latest"` | **observed 2026-09-20** — the sentinel is writable, not only readable |
| Unpinned `version_selector` rule | `{"type": "FixedRatio", "agent_version": "@latest", "traffic_percentage": 100}` | **observed 2026-09-20** — the sentinel, on every agent |

## Promoting a version — spec 031, read from the SDK 2026-09-19

> **This section is the one place in this file where the source is a shipped SDK rather than a doc
> page or a live observation, and it is labelled as such deliberately (§10).** Everything below
> comes from the `azure-ai-projects` **2.6.0** typespec — the generated models and their
> docstrings — which is a Microsoft artifact rather than anyone's memory, but is *not* the same as
> having seen the service accept the call.

### What the SDK settles

**There is no promote verb.** `AgentsOperations` exposes `create_version`, `get_version`,
`list_versions`, `delete_version`, `enable`, `disable` and `update_details` — and nothing named
promote, activate or set_version. Going back to a version is a **merge-patch on the agent
endpoint's routing**:

```python
agents.update_details(
    agent_name,
    agent_endpoint=AgentEndpointConfig(
        version_selector=VersionSelector(
            version_selection_rules=[
                FixedRatioVersionSelectionRule(agent_version="3", traffic_percentage=100)
            ]
        )
    ),
)
```

| Fact | Where it comes from |
|---|---|
| `AgentEndpointConfig.version_selector` — *"determines how traffic is routed to different versions of the agent"* | `azure-ai-projects` 2.6.0 model docstring |
| `VersionSelectionRule` has one subclass, `FixedRatioVersionSelectionRule`, carrying `agent_version` + `traffic_percentage` (0–100) | same |
| `AgentVersionDetails` carries `version` · `status` · `created_at` · `definition` · `draft` · `metadata` | same |
| The payload **cannot carry a definition**, so this route can never author an agent (spec 031, AC14) | asserted on the serialised body in `backend/tests/test_agent_promote.py` |

### The disagreement worth recording

The [Manage hosted agents](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/manage-hosted-agent)
doc says an agent endpoint serves **one** version at 100% and that traffic splitting is
unsupported. The type models a **list** of weighted rules. This repository sends exactly one rule
at 100% — the documented shape — and records the disagreement rather than exploring it.

### The credential, and what it turned out to be — corrected 2026-09-20

Spec 031 and everything after it recorded its open questions as blocked on a broken `az`:
`/usr/local/Cellar/azure-cli/2.69.0/libexec/bin/python: Bad CPU type in executable`, observed
2026-09-19.

**That was a diagnosis of the wrong binary.** The machine is `arm64`; `/usr/local` is the *Intel*
Homebrew prefix and its `az` cannot run, but an `arm64` build exists at `/opt/homebrew/bin/az`
(2.44.1), was already signed in, and works. The Intel one simply came first on `PATH`. Anything
shelling out to `az` — `DefaultAzureCredential`'s CLI source included — found the broken one and
concluded there was no credential.

So a read against the live project has been possible all along. The reads below were made on
**2026-09-20**; what is still open is open for a different reason now, and each says which.

### Read against the live service — 2026-09-20

`GET {project_endpoint}/agents/{name}?api-version=v1`, `…/versions` and `…/deployments`, with a
token for `https://ai.azure.com/.default`. Recorded, scrubbed of identity GUIDs, in
`backend/tests/fixtures/agent-endpoint-20260920.json`.

| Finding | Evidence |
|---|---|
| **`agents.get(name)` does return `agent_endpoint` populated — for every agent**, pinned or not. The listing still carries no such key, so spec 031's AC12 split (rail reports latest, detail resolves the pin) stands. | `GET /agents/foundry-live-agent` → `agent_endpoint.version_selector.version_selection_rules` present; `GET /agents` → the key is absent on all 10 |
| **An unpinned endpoint names the sentinel `@latest`**, not a version, in one `FixedRatio` rule at 100%. This is the finding that mattered: spec 031 read the typespec's `agent_version` as always being a version, so *having a selector* was treated as *being pinned*. Unresolved it matches no version row, the status falls to `unknown`, and a healthy agent reports `version_not_active` on the detail screen. Fixed in `_pinned_version`; the recorded payload drives the regression test. | both of this repo's agents; `foundry-live-agent` has 8 versions, all `active`, and served version 8 |
| **The endpoint carries more than the selector**: `protocols: ["responses"]`, `protocol_configuration`, `authorization_schemes: [{"type": "Entra"}]`, `publish_approval_status: "not_published"`. None of it is read by this app; recorded so the next reader knows the shape. | same response |
| **The projection was run against the live listing, not only the recording.** `summarise` renders all 10 agents with their kind, harness and version, every one selectable; `detail_of` on `foundry-live-agent` with the live endpoint and the live version list gives `served=8 latest=8 pinned=False status=active selectable=True`, four tools and its instructions; `versions_of` marks 8 served and not promotable, 1–7 promotable. Before the `@latest` correction the same inputs gave `version_not_active` and `selectable=False`. | the same three responses, through `backend/app/agents.py` unchanged |
| **The project serves 32 model deployments**, of which exactly one is neither chat nor embeddings: **`FLUX-1.1-pro`** (Black Forest Labs). Its `capabilities` map comes back **empty** — as does the Cohere embedding model's — so the listing does **not** declare it image-capable. Relevant to spec 044, and not sufficient for it; see below. | `GET …/deployments?api-version=v1`, 32 rows |

### The write, verified — 2026-09-20 (spec 031)

Run against `foundry-live-agent` through the app's **own** `promote_version`, not a copy of it, so
what was verified is the shape the route actually sends. Pinned to version 7, read back, restored
to `@latest`, read back again.

| Question | Answer |
|---|---|
| Does `update_details` accept this selector as written? | **Yes.** `update_details(name, agent_endpoint=AgentEndpointConfig(version_selector=VersionSelector(version_selection_rules=[FixedRatioVersionSelectionRule(agent_version="7", traffic_percentage=100)])))` is accepted, and the read-back shows the pin in effect. |
| Is it reversible? | **Yes** — and this matters more than it looks. `agent_version="@latest"` is accepted as a *write*, not only returned as a read, so a rollback demonstration restores the agent exactly rather than leaving it permanently pinned to a number. |
| Does `GET /agents` carry `agent_endpoint` once something is pinned? | **No.** While version 7 was serving, the listing returned the same six keys as ever — no `agent_endpoint` — and still reported `versions.latest.version: 8`. This **confirms** spec 031's AC12 split rather than removing it: the rail can only report the newest version, and the detail screen is the only place a pin can be resolved. |
| Which role does `update_details` require? | **Still unknown, and not claimed.** The write succeeded, but the identity that made it holds `Foundry User` *and* `Foundry Project Manager` on the account *and* `Owner` on the management group. Owner subsumes the question. Knowing the minimum needs an identity that has only the lesser role — which nobody has created. |

**The default stays `false`, and the reason is unchanged.** It was never only "unverified": the flag
is a *permission* question. Anyone who can reach this BFF can change which version the whole project
serves, and the app has no notion of a user to record. See [`SECURITY.md`](../SECURITY.md) — that
argument is untouched by the call now being known to work.

### Can a question carry a file? — the doc question is answered (spec 045), 2026-09-20

Spec 045 was **clarified and blocked** on its own first question: does the Responses API accept file
input alongside a message, and how? That question now has a doc behind it.

| Source | Read |
|---|---|
| [Use the Responses API](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses) | 2026-09-20 |

**Yes, as content parts on the message item** — and all three of the designs that "wear the same
name" are documented, which is why the spec could not pick one from memory:

| Part | Fields | Carries |
|---|---|---|
| `input_image` | `image_url` (an `https://` URL **or** a `data:` base64 URI) + optional `detail` (`low`/`high`/`auto`) | an image |
| `input_image` | `file_id` | an image already uploaded |
| `input_file` | `filename` + `file_data` (a `data:` base64 URI) | a document |
| `input_file` | `file_id` | a document already uploaded |

Upload is `POST /openai/v1/files` with `purpose=assistants`, returning `{"id": "file-…"}`. Stated
limits: **≤ 50 files per request, < 50 MB each and < 50 MB combined**. Images: PNG, JPEG, WebP,
non-animated GIF; documents: PDF (text plus page images) and ~30 other formats.

> **One caveat, and it is a forum post rather than a doc.** A [Microsoft Q&A
> thread](https://learn.microsoft.com/en-ca/answers/questions/5859143/new-microsoft-foundry-agent-via-responses-api-reje)
> reports a Foundry **agent** (Responses + an agent reference, which is this repo's path) rejecting
> a base64 `image_url` with `invalid_payload — The provided data does not match the expected
> schema`, where a public URL worked. The asker reports it fixed days later, so it reads as a
> regression rather than a difference in the contract — but it is the agent path, it is not a doc,
> and §10 does not let it stand as one. Whichever design a spec picks, **that leg is probed against
> the live service before it ships.**

**Spec 045 stays blocked, on the two blockers that were never documentation questions:**

- It would add a fourth field to `POST /chat`, whose shape `App.routing.test.tsx` pins to
  `message · conversation_id · agent` — the test spec 021 uses to keep this browser's record out of
  Foundry's state. That is a §9/§4 change with its own spec.
- **Retention is the operator's decision**: what is stored, for how long, and who can read it has to
  be settled before an upload endpoint exists, not after. Note what the doc adds to this — `file_id`
  means Foundry *keeps* the file, which is precisely the decision that has to be made first.

| Open question | How to close it |
|---|---|
| Which of the four shapes should this repo offer? | a decision, not a doc read — it follows the retention answer |
| Does the agent path accept a `data:` URI today? | one probe with a one-pixel PNG, once a design is chosen |
| Do the prompt and hosted harnesses agree? | the adapter-parameterised suite, once there is something to parameterise |

Measured in the meantime: the composer is already a multi-line `textarea` (spec 023), so a log, a
Bicep file or a CSV pastes today and travels as the `message` it is. A screenshot is the case that
genuinely needs the answer.

### Open — what shape does `response.mcp_call.failed` have? (O-33-1, noted 2026-09-20)

The normaliser builds a failed MCP call from `raw["item"]`, and **its own sibling proves that is
probably wrong**: `response.mcp_call.completed` was measured on 2026-09-15 to carry only `item_id`,
`output_index` and `sequence_number` — no `item` at all — which is exactly why the success path is
built from `response.output_item.done` instead. If `.failed` is shaped the same way, the card reads
`unknown / unknown` with a generic message.

Not fixed, because fixing it means choosing a shape nobody has seen, and both candidate designs
(read `output_item.done`; correlate by `item_id`) are guesses until a failure is observed. It is
marked `verified=False` in `MAPPINGS`, `GET /config` reports it among the unverified entries, and
`_mcp_call` degrades rather than raising, so the failure is still reported as a failure.

| To close it | How |
|---|---|
| The real payload of a failed MCP call | Point the Learn MCP tool at an unreachable `server_url`, record the stream with `ai/scripts/spike.py`, and build the handler from the recording |

### Open — how would the agent produce an image? (spec 044)

Spec 044 shipped its rendering half and **deferred its generation half**, deliberately.

Building a generation tool would mean naming an image model deployment, an SDK call, an
`api-version` and an output shape — a URL with a lifetime? base64? — none of which could be checked
against the live service — the 2026-09-20 session was read-only by decision, and generating an
image is not a read. §10
forbids writing any of that from memory, and a tool written against an API that changed through
2026 is the exact failure this repository exists to demonstrate the avoidance of.

What the rendering half establishes and does not need verifying: an image travels as a **URL in
`text_delta`**, so no tenth `AgentEvent` is needed for it (§9), and `react-markdown` sanitises a
`data:` source away, so base64 cannot reach the stream or this browser's record.

Half of the first question is now answered. The deployments listing was read on 2026-09-20 (above):
the project serves **`FLUX-1.1-pro`**, the only one of its 32 deployments that is neither chat nor
embeddings. That is a model *name*, and nothing more — its `capabilities` map is **empty**, so the
listing does not even declare it image-capable, and the call, the `api-version` and the output shape
are exactly as unknown as before. It narrows where to read; it is not a substitute for reading.

| Open question | How to close it |
|---|---|
| Under which call is `FLUX-1.1-pro` invoked, and on which `api-version`? | read the image-generation doc — the deployment name is now known |
| Does its output URL expire, and after how long? | generate one and watch it |
| Is it an Azure service under `DefaultAzureCredential`, or a third-party key? | the same doc; a third key after Tavily would need its own justification |

### Open — is barge-in observable? (spec 039)

Spec 012 configures `interrupt_response` on the semantic detectors, so the service **does** cut the
agent off when the user speaks over it. What is not established is whether the browser is **told**.

Checked across every `voice-live-*` recording in `ai/tests/fixtures/recorded/`: no event names an
interruption. The types present are `response.audio_transcript.delta`, `response.audio.delta`,
`response.function_call_arguments.*`, `conversation.item.created`, `response.output_item.*`,
`response.created` / `response.done`, and the VAD frames — nothing like
`input_audio_buffer.speech_started` or a truncation notice.

So spec 039's AC5 is **deferred rather than guessed**. An agent turn that stopped producing audio
and one that finished sound identical, and inferring the difference from silence would be a
measurement we did not make (§5).

| Open question | How to close it |
|---|---|
| Does the control channel emit anything when the user barges in? | run a session, talk over the agent mid-answer, record the frames |
| If it does, is it on the data channel or the control WebSocket? | the same recording answers both |

### What the comparison measures — answered (spec 020, AC16)

`/compare` puts one question to two agents at once and draws two columns. Everything about **how**
it does that is verified: the two requests are two ordinary `POST /chat` calls, each already
carrying `agent` and its own `conversation_id`, so the feature needed no contract change and none
was made. `frontend/src/panes/Compare.test.tsx` asserts the two turns share no conversation, that one
column failing leaves the other running, and that stopping settles both.

**Historical initial deferral.** The implementation session initially left AC16 unmeasured rather
than fabricating a live fixture. That deferral was superseded by the recorded run below; it is not
an outstanding acceptance criterion now. This reconciliation does not constitute a new live run.

**Closed 2026-09-20.** Six turns, three probes, both agents, through the real BFF. The measurements
are in [`harness-comparison.md`](harness-comparison.md) and every turn is committed under
`ai/tests/fixtures/recorded/compare-*`.

| Question | Answer |
|---|---|
| How far apart are the two harnesses on the same question? | **Time to first text: about 2–3× in these probes** — 6.4/4.3/6.6s for the prompt agent against 14.6/13.6/13.9s for the hosted one. *Total* durations overlap. This run cannot identify planning, cold starts, network effects or throughput as the cause. |
| Does the hosted column really report `usage: null`? | **Yes**, in all three probes. Spec 018's measurement holds, and `MetaLine` renders nothing rather than a zero. |
| Does a hosted turn emit `mcp_call` at all? | **No — not once.** Learn arrives as `microsoft_docs_search` / `microsoft_docs_fetch` with `executor: "foundry"`, because the container is the MCP client. The prompt agent emits `mcp_call` for the same work. |

These are **one prompt and one hosted turn per probe, from one machine on one day**, not a benchmark, and the numbers
include a localhost hop. Said here rather than left for a reader to assume.

One property this spec did **not** need a credential for, and which is asserted rather than assumed:
the BFF resolves the harness per request and never mutates `app.state.harness` (spec 019), so two
concurrent turns from one browser cannot change each other's agent.

### Does the agent actually write a chart block? — answered, and the answer is no (spec 033)

`ai/harness/_shared/agent_core.yaml` now tells the agent how to write a `foundry-chart` block, and
CI proves the **instructions and the renderer agree**: every worked example in that YAML is parsed
by `parseChart` (`frontend/src/state/chartContract.test.ts`). That is a real guard against the two
drifting apart, which is what `agent_core.yaml` exists to prevent.

It was **not** evidence that the model follows them. It has now been asked, and the answer is no.

### Answered 2026-09-20 — the agent does not reach for a chart

Four turns, two probes, both agents. **Not one produced a `foundry-chart` block**, or a `mermaid`
one. Recorded under `ai/tests/fixtures/recorded/compare-chart-*`.

| Probe | What was asked | What came back |
|---|---|---|
| `chart-qualitative` | compare the two harnesses on cost to operate and what each gives you | Prose and headings. **This is the correct behaviour**: the instruction says "a comparison *of quantities*", the comparison document available to that historical run carried no quantitative chart inputs, and another rule in the same block forbids inventing a value it does not have. Recorded because declining for the right reason is a finding. |
| `chart-quantities` | the populations of São Paulo, Rio and Brasília, compared | **A Markdown table** — three real figures from IBGE via `search_web`, ranked, with ratios and percentages in prose. Every condition the instruction describes was met. It still chose a table. |

So the gap is not the renderer and not the schema — CI proves those agree — it is that **`gpt-5.5`
prefers a table for a three-value comparison**, and the instruction's "you **may** draw it" gives it
every right to. Two honest ways forward, and neither is free:

- Make the instruction directive for the case it describes ("when the answer compares three or more
  quantities, draw it") and measure again. That is a change to `agent_core.yaml` and therefore a
  change to how the agent behaves in *every* turn, including voice.
- Accept it. A table of three numbers is not a worse answer, spec 035 gives it a copy-as-TSV
  control, and an agent that charts because it was told to rather than because it helps is the
  over-reach the same spec listed as a risk.

**Not decided here.** The measurement is the deliverable; changing the agent's behaviour on the back
of one probe would be the reflex this repository exists to argue against.

| Still open | How to close it |
|---|---|
| Does a more directive instruction produce a chart, and at what cost to ordinary answers? | edit `agent_core.yaml`, apply, re-run `compare_harnesses.py --probe chart-quantities`, compare against these recordings |
| Does it over-reach once told to — charting a single number, or a breakdown it invented? | the same run, plus one where the data is thin |

The recorded listing (`backend/tests/fixtures/agents-listing-20260916.json`, 10 agents) carries **no
`agent_endpoint` key at all** — consistent with nothing ever having been pinned, and not proof that
the field would be omitted if something were. `test_agent_versions.py` asserts that premise, so a
future recording that contradicts it fails loudly instead of quietly invalidating the reasoning.

## Copilot learning paths — sources read 2026-10-09

These **public official pages were read on 2026-10-09**, independently of the historical evidence
above. This does not reverify earlier APIs, run a tenant integration, select a product, or authorize
credentials/spend. The comparison and proposed lesson are in
[English](copilot-learning-paths.md) / [Português](copilot-learning-paths.pt-BR.md).
Source IDs make the same claim traceable from both translations; product entitlement/status can change.

| ID | Official source | What this reading confirms / limits |
|---|---|---|
| C01 | [VS Code MCP servers](https://code.visualstudio.com/docs/agent-customization/mcp-servers) | Tools/resources/prompts/MCP Apps, local/remote execution and server trust. Configuration scope matters; local code is privileged. |
| C02 | [GitHub Copilot CLI](https://docs.github.com/en/copilot/concepts/copilot-surfaces/copilot-cli) | Terminal agent/customizations, local versus cloud modes, broad tool-approval risks. Cloud sandbox is explicitly public preview; do not apply that label to every CLI mode. |
| C03 | [Copilot on GitHub](https://docs.github.com/en/copilot/concepts/copilot-surfaces/copilot-on-github) | Ephemeral cloud development execution; remote control does not relocate a local CLI session. |
| C04 | [Configure repository MCP servers](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/configure-mcp-servers) | Cloud agent/review tools only, no remote OAuth or per-call approval; admin configuration and review readOnlyHint requirement. |
| C05 | [GitHub Copilot plans](https://docs.github.com/en/copilot/get-started/plans) | Current client entitlement/limits and GitHub AI Credits; organization policies still apply. No price literals copied. |
| C06 | [Studio MCP](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agent-extend-action-mcp) | Standard-harness generative orchestration supports MCP tools and resources. Not proof of every MCP primitive. |
| C07 | [Studio MCP onboarding](https://learn.microsoft.com/en-us/microsoft-copilot-studio/mcp-add-existing-server-to-agent) | Streamable transport, no-auth/API-key/OAuth choices; legacy MCP SSE no longer supported. |
| C08 | [Studio licensing/access](https://learn.microsoft.com/en-us/microsoft-copilot-studio/requirements-licensing-subscriptions) | Trial cannot publish; Teams subset differs from standalone and lacks generative orchestration in the reviewed table. |
| C09 | [Studio connected agents](https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-add-other-agents) | Child/connected/external-agent distinctions, extra orchestration/latency; Foundry connection public preview. |
| C10 | [Studio → Foundry agent](https://learn.microsoft.com/en-us/microsoft-copilot-studio/add-agent-foundry-agent) | Preview, standard harness, new-portal agent requirement and Activity endpoint prerequisite; Responses/A2A alone insufficient. No enabling API copied or run. |
| C11 | [M365 agents overview](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/agents-overview) | Declarative versus custom-engine orchestration and responsibility. Not the repository's two harnesses. |
| C12 | [M365 declarative MCP plugin](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/build-mcp-plugins) | Remote-server plugin, dynamic discovery/pinned tools/MCP Apps, auth choices, custom-upload/Copilot access gates. Walkthrough not executed. |
| C13 | [MCP as plugin capability](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/plugin-type-mcp-servers) | Host-specific feature/governance support; package references a server without hosting it. |
| C14 | [Publish Foundry to Copilot/Teams](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/publish-copilot) | Stable endpoint, Activity, Bot Service/channel/package; personal/shared versus tenant authorization/admin approval. Foundry User plus Bot Service permissions, not project role alone. Does not confirm this repo's client-side functions on that channel. |
| C15 | [Work IQ MCP](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/work-iq/mcp/overview) · [API overview](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/work-iq/api-overview) | M365 tool access in the opposite direction, including write/delete and Copilot invocation; Entra OAuth, permission/policy boundary. No tenant access made; exact selected flow/entitlement unresolved. |
| C16 | [M365 extensibility costs](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/cost-considerations) | Eligible base subscription/Chat/add-on paths, shared-data credits, custom-engine Chat add-on distinction. Not a waiver of Azure/model hosting costs. |
| C17 | [Foundry MCP](https://learn.microsoft.com/en-us/azure/foundry/agents/how-to/tools/model-context-protocol) | Remote MCP, connections/approval, current Foundry User and Foundry Project Manager role names. No SDK/version/config changed. |
| C18 | [Learn MCP overview](https://learn.microsoft.com/en-us/training/support/mcp) | Public Streamable HTTP endpoint https://learn.microsoft.com/api/mcp, no authentication/server charge, public docs only; client costs/terms remain. A browser GET/405 is not an MCP availability test. |
| C19 | [Learn MCP getting started](https://learn.microsoft.com/en-us/training/support/mcp-get-started) | GitHub Copilot/VS Code documented route, CLI plugin alternative, actual search/fetch/code-sample tool names. No installation or tool call performed here. |

**Still open:** selected Copilot client/product/license/tenant; policy/data/credential/spend consent;
actual public Learn call capture; Studio/Activity compatibility of this repository's exact agents;
where client-side function outputs would be answered outside its BFF. These require explicit selection
and, for new integration code/configuration/contracts, a clarified spec before implementation.
Issue #37 is research-partial, not a delivered M365 connector or third harness.
