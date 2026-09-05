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
