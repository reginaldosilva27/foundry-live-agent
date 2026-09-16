"""The agent itself — the code Foundry runs in a container.

Everything in this package executes **inside the hosted agent sandbox**, not in the BFF. It is the
one place in this repository where an agent loop legitimately lives: §8 forbids the loop in
`backend/` and `frontend/`, and `ai/harness/<name>/` is where an agent is *authored*. The adapter
one directory up runs in the BFF and contains no loop at all; this package is deployed to Foundry
and is nothing but loop.

Nothing in `backend/` may import from here.
"""
