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
infra:
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

# ── Quality gates (mirrors of CI — see constitution §3) ───────────────────
gate-backend:
    cd backend && ruff check . && ruff format --check . && pytest -q

gate-ai:
    cd ai && ruff check . && pytest -q

gate-frontend:
    cd frontend && npm run lint && npm test && npm run build

gate-infra:
    cd infra && az bicep build --file main.bicep && az bicep lint --file main.bicep

# Everything CI runs. A layer with no code yet skips clean — that is green.
verify: gate-backend gate-ai gate-frontend gate-infra

# Fix what is auto-fixable.
fmt:
    -cd backend && ruff format . && ruff check --fix .
    -cd ai && ruff format . && ruff check --fix .

# ── Teardown ──────────────────────────────────────────────────────────────
down:
    cd infra && azd down

# ── Manual step: the AI Gateway has no documented IaC path (see infra/README.md) ──
gateway:
    @echo "AI Gateway is a Foundry portal flow — it has no documented Bicep/azd path."
    @echo "  1. https://ai.azure.com → Manage → AI Gateway → Add AI Gateway"
    @echo "  2. Create new (Basic v2) or reuse an existing APIM v2-tier instance"
    @echo "  3. Add this project to the gateway (new projects are enabled by default)"
    @echo "  4. Set per-project token limits: over TPM -> 429, over quota -> 403"
    @echo "See docs/how-it-works/tracing-and-gateway.md"
