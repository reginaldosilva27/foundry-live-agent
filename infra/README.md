# `infra/` — Bicep + azd

Provisions the Foundry side: resource, project, model deployment, Application Insights.

```bash
azd up      # provision + apply the agent definition
azd down    # tear everything down
```

## What this provisions

| Resource | Why |
|---|---|
| Foundry resource + project | Hosts the prompt agent; the project endpoint is the single API surface |
| Model deployment | `gpt-5.4` by default (configurable) |
| Application Insights | Agent tracing lands here; the trace drawer queries it |

## What this does *not* provision

**The AI Gateway.** It has no documented Bicep/azd path — it is a Foundry portal flow
(*Manage → AI Gateway*) that creates or associates an **APIM v2-tier** instance. Rather than ship IaC
we cannot verify (constitution §5), the README documents it as a manual step with a `just gateway`
helper. If a supported IaC path appears, this becomes a spec.

## Gate

> **Bicep, not Terraform** — the constitution was amended on purpose; see its *Amendment process* table.

```bash
az bicep build --file main.bicep && az bicep lint --file main.bicep
```

**Still empty.** Spec 002 declared Bicep a non-goal — *"`infra/` stays empty until the spike
confirms what to provision"* — and the spike's answer never became a spec. The CI job skips this
layer with a notice while `main.bicep` is absent, which is why the gate is green on an empty
directory. Provisioning is a manual portal/CLI step today; spec 005 is where Application Insights
gets a home.
