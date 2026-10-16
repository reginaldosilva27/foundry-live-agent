"""What an upstream failure may say to the browser, and where the rest goes.

`ErrorCard` renders an error event's `message` verbatim, and an exception's text from the Azure SDK
is the service's own error body: request ids, resource ids, endpoints. The 2026-10-15 assessment
saw a forged conversation id put Foundry's whole 400 body on screen. So the message is the
exception's **class** — enough to tell a timeout from a refusal — and the text goes to the log of
the process that caught it, where the operator reads it.

Refused, not scrubbed: deciding which parts of an upstream message are safe is the part that gets
subtly wrong (the same reasoning as `ID_SHAPE` in `backend/app/traces.py`).
"""

from __future__ import annotations

import logging


def client_message(exc: BaseException, log: logging.Logger, context: str) -> str:
    """Log ``exc`` in full under ``context`` and return what the browser may see: its class."""
    log.warning("%s: %s: %s", context, type(exc).__name__, exc, exc_info=exc)
    return type(exc).__name__
