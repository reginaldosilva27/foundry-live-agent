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

## Requirement for whoever builds the frontend host (spec 024)

The frontend uses the **History API**, so it has real addresses: `/`, `/agents`, `/c/<id>`,
`/trace/<response_id>`. Any host serving the built `frontend/dist` **must serve `index.html` for
unknown paths**, or a deep link — the trace link somebody sends a colleague, which is the point of
the feature — answers 404.

Vite's dev server already does this, so `just frontend` needs nothing. This is written here rather
than shipped as Bicep because there is no frontend deployment in this repository yet, and
unverifiable infrastructure is a documented manual step, not IaC nobody has run (constitution §5).

- **Azure Static Web Apps** — a `staticwebapp.config.json` with a `navigationFallback` to
  `/index.html`.
- **A container serving the build** — the server's try-files equivalent, falling back to
  `index.html`.
