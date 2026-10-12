"""Serialize synchronous reads and cleanup without holding the event loop."""

from __future__ import annotations

import asyncio
import logging
import threading
from collections.abc import AsyncIterator, Callable, Iterable


async def stream_items[T](factory: Callable[[], Iterable[T]]) -> AsyncIterator[T]:
    """Close a per-leg iterator, after any already-running read has returned.

    Cancellation cannot interrupt synchronous I/O. The cleanup worker waits for the read's lock;
    the cancelled coroutine need not wait for that worker. No further read is submitted.
    """
    lock = threading.Lock()
    stream = None
    closed = False
    exhausted = object()

    def read():
        nonlocal stream
        with lock:
            if closed:
                return exhausted
            if stream is None:
                stream = iter(factory())
            return next(stream, exhausted)

    def close():
        nonlocal closed
        with lock:
            closed = True
            if stream is not None and (cleanup := getattr(stream, "close", None)):
                try:
                    cleanup()
                except Exception:  # noqa: BLE001 - cleanup must not add a second terminal event
                    logging.getLogger(__name__).exception("synchronous stream cleanup failed")

    try:
        while True:
            item = await asyncio.to_thread(read)
            if item is exhausted:
                return
            yield item
    finally:
        # Submit before awaiting: an ASGI cancellation scope may cancel every subsequent await.
        cleanup = asyncio.get_running_loop().run_in_executor(None, close)
        cleanup.add_done_callback(lambda future: future.exception())
        task = asyncio.current_task()
        if task is None or not task.cancelling():
            await asyncio.shield(cleanup)
