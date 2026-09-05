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

## Supported versions

The project is pre-1.0. Fixes land on `main`; there are no backports.
