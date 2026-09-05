"""The BFF package.

The backend imports the §9 contract and the client-side tools from the `ai/` layer rather than
duplicating them — one source of truth (constitution §4). `ai/` is a sibling directory, not an
installed distribution, so its path is added here.

This is deliberately explicit rather than hidden in a launcher script or an environment variable:
`import app` is the one thing every entry point does (uvicorn, pytest, the scripts), so the
bootstrap belongs where it cannot be forgotten.
"""

import sys
from pathlib import Path

_AI_LAYER = Path(__file__).resolve().parent.parent.parent / "ai"
if _AI_LAYER.is_dir() and str(_AI_LAYER) not in sys.path:
    sys.path.insert(0, str(_AI_LAYER))
