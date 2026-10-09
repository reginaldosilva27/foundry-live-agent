# foundry-live-agent — task runner
#
# One documented command per service. The GATE recipes deliberately restate nothing:
# they run exactly the commands in .specify/constitution.md "Quality gates", which
# .github/workflows/ci.yml and both verify-gates twins also mirror (constitution §4).

# Recipes read the .env this project already documents. Without this, `just backend` starts the
# BFF with no FOUNDRY_* variables at all: `/config` reports blanks and the first message fails on
# a SettingsError rather than reaching Foundry.
set dotenv-load := true

default:
    @just --list

# ── Setup ─────────────────────────────────────────────────────────────────
# Copy the env template. Never overwrites an existing .env.
env:
    @test -f .env && echo ".env already exists — leaving it alone." || (cp .env.example .env && echo "Created .env — fill it in.")

# Sign in to Azure. Everything authenticates with Entra ID; there are no API keys.
login:
    az login

# ── Run each service (one command per service) ────────────────────────────
# Provision Foundry (resource, project, model deployment, App Insights).
#
# There is NO IaC in this repository yet: `infra/` carries no `main.bicep` and no azd project, so
# this recipe used to run `azd up` in a directory with nothing to provision and fail on the third
# line of the Quickstart. Until a spec fills that layer, it says what to do by hand -- the same
# shape as `just gateway` below, for the same reason: documenting a manual step beats shipping
# IaC nobody verified (constitution §5).
infra:
    #!/usr/bin/env bash
    if [ ! -f infra/main.bicep ]; then
      echo "infra/ has no main.bicep -- this repository ships no IaC yet, so there is nothing to run."
      echo "Provisioning is a documented MANUAL step. See infra/README.md."
      echo "The two pages it needs are already recorded in docs/REFERENCES.md, 'Provisioning (azd / Bicep)':"
      echo "  Foundry resource via Bicep   https://learn.microsoft.com/en-us/azure/foundry/how-to/create-resource-template"
      echo "  azd Foundry agent extension  https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/extensions/azure-ai-foundry-extension"
      echo "Then fill the FOUNDRY_* variables in .env and continue at step 4 ('just agent')."
      exit 1
    fi
    cd infra && azd up

# Apply the agent definition from the selected harness's agent.yaml.
agent:
    cd ai && python scripts/apply_agent.py

# --- The hosted agent (spec 018) ------------------------------------------
# The prompt agent is `just agent` above: one SDK call, no container. This one is a container
# Foundry runs, so it has a build and a deploy instead.

# Regenerate ai/azure.yaml from ai/harness/langgraph/agent.yaml. A test fails if you forget.
hosted-config:
    cd ai && python scripts/build_hosted_config.py

# Build the image. The context is `ai/`, not the agent directory: the image needs
# harness/_shared/ — the SAME tool implementations the BFF runs — and vendoring a copy would
# break the one-implementation rule (§4). See the Dockerfile's own comment.
hosted-build:
    cd ai && docker build -f harness/langgraph/agent/Dockerfile -t foundry-live-agent-hosted:dev .

# Deploy it. Needs Docker running, `azd auth login`, and the Foundry Project Manager role.
hosted-deploy:
    cd ai && azd provision && azd deploy

# Record a live turn against the deployed hosted agent, for the fixtures (§5).
hosted-record:
    cd ai && python scripts/spike_hosted.py

# Run the BFF. create_app is a factory, hence --factory.
backend:
    cd backend && uvicorn app.main:create_app --factory --reload --port ${BACKEND_PORT:-8000}

# Run the UI.
frontend:
    cd frontend && npm run dev

# ── Look at it first, with no Azure at all (spec 050) ─────────────────────
# Replays turns recorded from real Foundry runs. No subscription, no `az login`, no provisioning.
# A different entrypoint from `just backend`, on purpose: `create_app` never learns this exists, so
# no variable can make a real deployment serve a recording as a live answer. A banner says so on
# every screen, and it cannot be dismissed.
demo:
    #!/usr/bin/env bash
    set -euo pipefail
    backend_pid=''
    frontend_pid=''
    cleanup() {
      if [ -n "$backend_pid" ]; then kill "$backend_pid" 2>/dev/null || true; fi
      if [ -n "$frontend_pid" ]; then kill "$frontend_pid" 2>/dev/null || true; fi
      wait 2>/dev/null || true
    }
    trap cleanup EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    (cd backend && exec uvicorn app.demo:create_demo_app --factory --port ${BACKEND_PORT:-8000}) &
    backend_pid=$!
    # Start Vite directly so the PID we own is the server, not an npm wrapper.
    (cd frontend && exec node node_modules/vite/bin/vite.js --strictPort) &
    frontend_pid=$!
    while kill -0 "$backend_pid" 2>/dev/null && kill -0 "$frontend_pid" 2>/dev/null; do
      sleep 1
    done
    if ! kill -0 "$backend_pid" 2>/dev/null; then
      wait "$backend_pid"
    else
      wait "$frontend_pid"
    fi

# ── Quality gates (mirrors of CI — see constitution §3) ───────────────────
gate-backend:
    cd backend && ruff check . && ruff format --check . && pytest -q

gate-ai:
    cd ai && ruff check . && pytest -q

gate-frontend:
    cd frontend && npm run lint && npm test && npm run build

# The only gate recipe with a guard, and it is a mirror rather than an exception: ci.yml's infra
# job skips with a notice while `main.bicep` is absent (`if [ ! -f main.bicep ]`). Without the same
# line here, `just verify` failed locally on a layer CI calls green -- the four mirrors (§4, §6)
# disagreeing about what "done" means.
gate-infra:
    #!/usr/bin/env bash
    if [ ! -f infra/main.bicep ]; then
      echo "infra/ not set up yet -- skipping."
      exit 0
    fi
    cd infra && az bicep build --file main.bicep && az bicep lint --file main.bicep

# Everything CI runs. A layer with no code yet skips clean — that is green.
verify: gate-backend gate-ai gate-frontend gate-infra

# Fix what is auto-fixable.
fmt:
    -cd backend && ruff format . && ruff check --fix .
    -cd ai && ruff format . && ruff check --fix .

# ── Teardown ──────────────────────────────────────────────────────────────
down:
    #!/usr/bin/env bash
    if [ ! -f infra/main.bicep ]; then
      echo 'infra/ has no main.bicep -- azd never created anything here, so there is nothing to tear down.'
      echo "Delete the Foundry resource group (and the APIM instance, if you created one) in the portal."
      exit 1
    fi
    cd infra && azd down

# ── Manual step: the AI Gateway has no documented IaC path (see infra/README.md) ──
gateway:
    @echo "AI Gateway is a Foundry portal flow — it has no documented Bicep/azd path."
    @echo "  1. https://ai.azure.com → Manage → AI Gateway → Add AI Gateway"
    @echo "  2. Create new (Basic v2) or reuse an existing APIM v2-tier instance"
    @echo "  3. Add this project to the gateway (new projects are enabled by default)"
    @echo "  4. Set per-project token limits: over TPM -> 429, over quota -> 403"
    @echo "See docs/how-it-works/tracing-and-gateway.md"
