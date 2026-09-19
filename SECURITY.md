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

## Supported versions

The project is pre-1.0. Fixes land on `main`; there are no backports.
