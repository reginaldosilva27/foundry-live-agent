# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Report it privately through
[GitHub Security Advisories](https://github.com/reginaldosilva27/foundry-live-agent/security/advisories/new).
Include what you found, how to reproduce it, and the impact you expect. You'll get an
acknowledgement within a few days.

## Scope

This is a reference implementation, not a hosted service. There is no deployment of it to attack —
the interesting surface is what someone gets by running this code in **their own** Azure subscription.

Particularly in scope:

- Anything that would place an Azure credential in the browser, or otherwise widen the trust boundary
  described in [`docs/architecture.md`](docs/architecture.md).
- Anything that leaks a secret into the repository, into telemetry, or into a container image.
- Over-broad RBAC in `infra/`.
- Prompt-injection paths that let untrusted content reach a tool with side effects.

## Design commitments

These are properties the project intends to hold. A break in any of them is a security bug:

- **No secrets in the repository.** `.env.example` contains placeholders only; `.env` and `.azure/`
  are gitignored. Every Azure call authenticates with Microsoft Entra ID via `DefaultAzureCredential`
  — there are no API keys in the design.
- **The browser never holds an Azure credential.** Voice audio flows peer-to-peer over WebRTC while
  the Entra token stays on the BFF's control channel.
- **Tool arguments and tool outputs are untrusted input.** They are validated before use, and the
  function tools are read-only by design — no side effects that could be triggered by injected text.
- **So is anything that arrives in a URL.** `GET /trace/{response_id}` puts its path parameter into
  a KQL query run with the BFF's own identity, against a workspace holding prompts and tool
  arguments. The id is checked against `ID_SHAPE` in `backend/app/traces.py` and **refused** when it
  does not match, rather than escaped on the way in — escaping is the part that gets subtly wrong.
  Anything else reaching a query, a path or a command deserves the same treatment.
- **Telemetry is treated as production data.** Traces capture prompts, tool arguments and tool
  results; secrets must never be placed in them, and access is controlled like any other log.
- **The app reads Foundry. It writes in exactly one place, and that place is off by default.**
  See below.

## The one write surface

`POST /agents/{name}/versions/{version}/promote` (spec 031) changes which version of an agent the
Foundry project serves. It is the only request this application makes that changes anything, and it
deserves reading carefully before you turn it on.

**What it can do.** Route 100% of an agent's traffic to an existing version. That is all: the route
takes **no request body**, so there is nowhere to put an agent definition, and it can never become a
way to create or edit an agent. Creating a version stays with `ai/scripts/apply_agent.py`, from a
definition in the repository.

**Who it affects.** Everyone talking to that project, not just the browser that pressed the button,
and from the next turn onwards. Every other persistent thing in this app — the conversation history,
the favourite agents, the collapsed rail — lives in one browser's `localStorage`. This one does not.

**Three gates, and only one of them is a permission:**

| Gate | What it is | Default |
|---|---|---|
| `FOUNDRY_ALLOW_VERSION_PROMOTE` | Whether this deployment offers the surface at all. Gates both the route and the capability reported by `GET /config`, so the control does not render. | **off** |
| `OWNED_AGENT_NAMES` | Whether the named agent is one this repository authored — derived from the `name` in each harness `agent.yaml`. Enforced in the BFF, not only in the UI. | the repo's own agents only |
| **RBAC on the deployment identity** | Whether the write actually succeeds. | granted by you, deliberately |

The flag **reveals a control; it cannot grant a permission.** A deployment that turns it on without
the role gets a `forbidden` the screen renders as the configuration fact it is. Conversely, granting
the role without the flag leaves the surface closed. Turn on neither unless you mean both.

**Anyone who can reach this BFF can promote.** This application has no notion of a user, no sign-in
and no authorization of its own. If the BFF is reachable by more than the people you would trust to
roll your agents back, do not enable this. That is why off is the default.

**Where the audit trail is.** Not here. The app records nothing about a promotion — a "who" it
printed would be invented, since it has no identity to print. The actor of record is the BFF's own
managed identity, and the durable trail is Azure's. A BFF shared by several people therefore makes a
promotion **unattributable by design**; if you need attribution, put something in front of this app
that has users.

**The role assignment is a manual step**, documented rather than shipped: there is no Bicep in this
repository yet, and shipping unverified IaC would be worse than saying so (constitution §5).

## The tool playground

`POST /tools/{name}/run` (spec 042) executes one of this build's function tools with arguments a
caller supplies. It runs no model, creates no conversation and writes nothing — but it is still the
most consequential thing to turn on in this application, for a reason that has nothing to do with
Foundry:

**An enabled playground is an unauthenticated way to spend `TAVILY_API_KEY`.** `search_web` calls a
metered third-party API, and anyone who can reach the BFF can call it with any query they like, as
often as they like. The BFF also becomes a machine that fetches arbitrary search queries on
somebody's behalf, which is a different kind of exposure from anything else here.

`lookup_knowledge` and `get_current_datetime` read local data and cost nothing.

**It has its own switch** (`FOUNDRY_ALLOW_PLAYGROUND`, off by default), deliberately not shared
with any other developer surface: spec 038's event inspector reads what already happened and costs
nothing, and bundling the two would let somebody turn on a meter while meaning to turn on a log.

The endpoint **refuses when the flag is off**, rather than the screen merely being hidden — hiding
a control is not a control.

**The demo entrypoint turns it on** (spec 050). `just demo` is a local tool for reading the code,
and a checkout that has no Azure credential normally has no `TAVILY_API_KEY` either — `search_web`
answering `search_unavailable` is the expected output there, and the most instructive one. If you
do have a key in your environment, `just demo` will spend it. It binds to localhost like `just
backend` does; neither is a thing to expose.

## Demo mode

`uvicorn app.demo:create_demo_app` (spec 050) serves turns recorded from real Foundry runs. Two
properties are deliberate and both are tested:

- **It is a separate entrypoint, not a flag.** `create_app` does not import `app.demo`, no
  environment variable reaches it, and a test walks the import graph to keep it that way. A flag
  would mean a mistyped variable could make a real deployment answer from a recording, and nothing
  downstream could tell the difference.
- **It is unmistakable from the browser.** `GET /config` reports the replay, and the banner that
  reports it has no dismiss control.

The recordings are redacted (`ai/scripts/redact_fixture.py`) and already in the repository; demo
mode reads them and writes nothing.

## Supported versions

The project is pre-1.0. Fixes land on `main`; there are no backports.
