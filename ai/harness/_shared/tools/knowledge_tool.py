"""`lookup_knowledge` — a client-side function tool over a pluggable knowledge source.

The seam that matters here is :class:`KnowledgeSource`. Today it is a folder of markdown; later it
is Foundry IQ. Swapping them changes **one class** — not the tool, not its schema, not its
registration. That is the whole reason this indirection exists in a repo that otherwise avoids
abstraction for single-use code.

The local implementation is a **scored keyword match**, and says so. It is not semantic search and
does not pretend to be: calling a keyword matcher "semantic" would claim a capability the code does
not have (constitution §5).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol, runtime_checkable

__all__ = [
    "SCHEMA",
    "KnowledgeSource",
    "LocalMarkdownKnowledge",
    "Passage",
    "lookup_knowledge",
]

SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "query": {
            "type": "string",
            "description": (
                "What to look up in the project's knowledge base, in natural language."
            ),
        }
    },
    "required": ["query"],
    "additionalProperties": False,
}

_WORD = re.compile(r"[a-z0-9]+")


@dataclass(frozen=True)
class Passage:
    """One retrieved chunk, always carrying where it came from."""

    text: str
    source: str
    score: float


@runtime_checkable
class KnowledgeSource(Protocol):
    """Anything that can answer a query with ranked passages.

    Implement this to swap the backing store. ``FoundryIqKnowledge`` will be one of these.
    """

    def search(self, query: str, limit: int) -> list[Passage]: ...


class LocalMarkdownKnowledge:
    """Scored keyword search over a folder of markdown files.

    Ranking: term frequency in the passage, a bonus when a term appears in the passage's heading,
    normalised by passage length so a long file cannot win by size alone. Deliberately simple and
    inspectable — this is a reference implementation, not a retrieval system.
    """

    def __init__(self, directory: Path | str) -> None:
        self.directory = Path(directory)

    def search(self, query: str, limit: int) -> list[Passage]:
        terms = _WORD.findall(query.lower())
        if not terms:
            return []

        scored: list[Passage] = []
        for path in sorted(self.directory.glob("*.md")):
            for heading, body in _split_sections(path.read_text()):
                score = _score(terms, heading, body)
                if score > 0:
                    text = f"{heading}\n{body}".strip() if heading else body.strip()
                    scored.append(Passage(text=text, source=path.name, score=score))

        scored.sort(key=lambda p: (-p.score, p.source))
        return scored[:limit]


def _split_sections(markdown: str) -> list[tuple[str, str]]:
    """Split on markdown headings so a passage is a section, not a whole file."""
    sections: list[tuple[str, str]] = []
    heading = ""
    body: list[str] = []
    for line in markdown.splitlines():
        if line.startswith("#"):
            if heading or body:
                sections.append((heading, "\n".join(body)))
            heading = line.lstrip("#").strip()
            body = []
        else:
            body.append(line)
    if heading or body:
        sections.append((heading, "\n".join(body)))
    return sections


def _score(terms: list[str], heading: str, body: str) -> float:
    body_words = _WORD.findall(body.lower())
    if not body_words:
        body_words = []
    heading_words = set(_WORD.findall(heading.lower()))

    hits = sum(body_words.count(term) for term in terms)
    heading_hits = sum(1 for term in terms if term in heading_words)
    if hits == 0 and heading_hits == 0:
        return 0.0

    length_norm = max(len(body_words), 20)
    return (hits / length_norm) + (heading_hits * 0.5)


def lookup_knowledge(query: str, source: KnowledgeSource, limit: int = 3) -> dict[str, Any]:
    """Return ranked passages for ``query``.

    No match is an empty list, not an error — "I found nothing" is a legitimate answer the agent can
    relay, whereas an error would invite it to retry a query that will keep finding nothing.
    """
    passages = source.search(query, limit)
    return {
        "query": query,
        "passages": [
            {"text": p.text, "source": p.source, "score": round(p.score, 4)} for p in passages
        ],
    }
