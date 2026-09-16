# The hosted agent image (spec 018).
#
# THE BUILD CONTEXT IS `ai/`, NOT THIS DIRECTORY. That is the load-bearing detail: the image must
# carry `harness/_shared/` — the same tool implementations and the same agent definition the BFF
# uses — and a context rooted here could not see them. Vendoring a copy instead would break the
# one-implementation rule this spec's AC6 exists to hold.
#
#   docker build -f harness/langgraph/agent/Dockerfile -t foundry-live-agent-hosted .
#
# `azure.yaml` says the same thing in azd's spelling (`docker.context: .`, project root `ai/`), and
# it is generated, so the two cannot drift.

FROM python:3.12-slim

# Unbuffered so the platform's log collection sees a crash as it happens rather than at flush.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# pip 25.0.1 — what python:3.12-slim ships as of 2026-09-16 — cannot resolve
# `langchain-azure-ai`: it fails with `InvalidVersion: Invalid version: 'hosting'` while
# enumerating candidates, with or without the extra, pinned or not. pip 26 resolves the same
# requirement cleanly, so the upgrade is load-bearing, not hygiene. Verified by building this image.
RUN pip install --no-cache-dir --upgrade "pip>=26"

# Dependencies before source: the layer cache then survives every code change.
COPY harness/langgraph/agent/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Only what the agent runs. `scripts/` and `tests/` stay out of the image — the sandbox's disk
# budget is shared between the image, $HOME and /files, so an image that carries the test suite is
# paying for it in session storage.
COPY harness/__init__.py ./harness/__init__.py
COPY harness/_shared ./harness/_shared
COPY harness/langgraph ./harness/langgraph

# Documentation, not a binding: Foundry sets PORT, and host.py reads it.
EXPOSE 8088

# Mirrors `startupCommand` in the generated azure.yaml.
CMD ["python", "-m", "harness.langgraph.agent.host"]
