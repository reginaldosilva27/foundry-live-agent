"""The agent's definition, read and proposed against — never written (spec 041).

The obvious feature is the one this project cannot have. §8 would permit editing the instructions
on screen and saving: a person configuring an agent is configuring, not running a loop. **§4
refuses it.** `ai/harness/_shared/agent_core.yaml` is the single source of truth for what the agent
is, and it exists *because* two copies of those instructions drifting a sentence at a time would
make this repository's central claim — that only the harness differs between the two agents —
unfalsifiable. A browser form writing to Foundry, or to the file, creates that second copy on the
first save.

So the file stays the truth and this makes the screen a better editor **of the file**. You edit; the
app hands back a diff to apply. Nothing here writes anything, and the wording never implies it did.

**What is read is the definition this build was made from** — not `main`, and not "the repository".
In a container the files are whatever was baked into the image, which may be neither, and calling
it what it is costs one label and removes a whole class of quiet lie (§5).
"""

from __future__ import annotations

import difflib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import harness._shared

from app.agents import AgentsUnavailable

__all__ = ["AgentDefinition", "definition_for", "propose", "yaml_with_instructions"]


@dataclass(frozen=True)
class AgentDefinition:
    """What this build's own definition says, and whether the service agrees."""

    #: Repository-relative, so the reader can find the file the diff is against.
    path: str
    #: Every agent whose definition resolves to that same file. Usually BOTH of them.
    shared_with: list[str]
    yaml: str
    instructions: str
    #: What the service is actually serving. ``None`` when the listing did not report it.
    served_instructions: str | None
    #: Whether the two differ. ``False`` when there is nothing to compare against.
    drifted: bool

    def as_dict(self) -> dict[str, Any]:
        return {
            "path": self.path,
            "shared_with": list(self.shared_with),
            "yaml": self.yaml,
            "instructions": self.instructions,
            "served_instructions": self.served_instructions,
            "drifted": self.drifted,
        }


def _harness_root() -> Path:
    return Path(harness._shared.__file__).resolve().parent.parent


def _entry_for(name: str) -> Path:
    """The `agent.yaml` whose `name:` is ``name``, or a typed refusal.

    Proposing a change to a file we do not have is meaningless, which is why an agent this
    repository did not write is refused here rather than rendered as an empty editor.
    """
    from harness._shared.agent_spec import load_agent_spec

    for path in sorted(_harness_root().glob("*/agent.yaml")):
        try:
            if load_agent_spec(path).name == name:
                return path
        except Exception:  # noqa: BLE001 - one unreadable harness must not hide the others
            continue
    raise AgentsUnavailable("not_owned", name)


def _declaring(path: Path) -> Path:
    """Walk `extends:` to the file that actually declares `instructions:`.

    **This is the fact the screen must not hide.** A harness's own `agent.yaml` names the agent and
    adds what is true of that harness; the instructions live in the shared `agent_core.yaml` that
    both of them extend. So editing the instructions of one agent edits BOTH — which is spec 018's
    design working exactly as intended, and a surprise to anyone who does not know it.
    """
    import yaml as _yaml

    seen: set[Path] = set()
    current = path
    while current.resolve() not in seen:
        seen.add(current.resolve())
        raw = _yaml.safe_load(current.read_text()) or {}
        if "instructions" in raw:
            return current
        parent = raw.get("extends")
        if not isinstance(parent, str):
            return current
        current = (current.parent / parent).resolve()
    return current


def _path_for(name: str) -> Path:
    return _declaring(_entry_for(name))


def _agents_sharing(declaring: Path) -> list[str]:
    """Every agent of ours whose instructions come from ``declaring``."""
    from harness._shared.agent_spec import load_agent_spec

    names: list[str] = []
    for path in sorted(_harness_root().glob("*/agent.yaml")):
        try:
            spec = load_agent_spec(path)
        except Exception:  # noqa: BLE001
            continue
        if _declaring(path).resolve() == declaring.resolve():
            names.append(spec.name)
    return names


def definition_for(name: str, served_instructions: str | None) -> AgentDefinition:
    """Read this build's definition for ``name`` and compare it with what is served.

    The comparison is the most useful thing on the screen: a deployment serving something other
    than what this build describes is drift, and a reader about to edit needs to know before they
    start rather than after they wonder why nothing changed.
    """
    entry = _entry_for(name)
    path = _declaring(entry)
    spec = _spec(entry)
    text = path.read_text()

    drifted = (
        served_instructions is not None and served_instructions.strip() != spec.instructions.strip()
    )
    return AgentDefinition(
        path=str(path.relative_to(_harness_root().parent.parent)),
        shared_with=_agents_sharing(path),
        yaml=text,
        instructions=spec.instructions,
        served_instructions=served_instructions,
        drifted=drifted,
    )


def _spec(path: Path):
    from harness._shared.agent_spec import AgentSpecError, load_agent_spec

    try:
        return load_agent_spec(path)
    except AgentSpecError as exc:
        raise AgentsUnavailable("invalid_definition", str(exc)) from exc


def yaml_with_instructions(text: str, instructions: str) -> str:
    """Rewrite the `instructions:` block of a YAML document, leaving everything else alone.

    Line-based rather than a YAML round trip on purpose: `yaml.safe_dump` would reformat the whole
    file — reordering keys, dropping every comment — and this repository's definitions are more
    comment than value. A diff of a reformatted file tells the reviewer nothing.
    """
    lines = text.splitlines(keepends=True)
    out: list[str] = []
    index = 0

    while index < len(lines):
        line = lines[index]
        out.append(line)
        index += 1
        if not line.startswith("instructions:"):
            continue

        # Skip the old block: every line that is blank or indented belongs to it.
        while index < len(lines) and (not lines[index].strip() or lines[index][:1] in " \t"):
            index += 1
        out.append(
            "".join(f"  {line}\n" if line.strip() else "\n" for line in instructions.splitlines())
        )

    return "".join(out)


def propose(name: str, instructions: str) -> dict[str, Any]:
    """Validate a proposed change and hand back the file and a diff. **Writes nothing.**

    The validation is `agent_spec.py`'s, not a second description of the schema (§4): the editor
    edits one field and the validator judges the result, so a proposal that would fail
    `apply_agent.py` fails here instead of at deploy time.
    """
    import tempfile

    from harness._shared.agent_spec import AgentSpecError, load_agent_spec

    entry = _entry_for(name)
    path = _declaring(entry)
    original = path.read_text()
    rewritten = yaml_with_instructions(original, instructions)

    # Validated through a copy in a temporary directory, beside the files it `extends:`, so the
    # real definition is never touched even for a moment.
    with tempfile.TemporaryDirectory() as tmp:
        try:
            # `extends:` is relative to the file that names it, so the whole harness tree is copied
            # into a temporary directory and the proposal replaces its one file there. The
            # repository is read and never written, including during a check.
            load_agent_spec(_materialise(entry, path, rewritten, Path(tmp)))
        except AgentSpecError as exc:
            return {"ok": False, "error": str(exc), "yaml": "", "diff": ""}

    diff = "".join(
        difflib.unified_diff(
            original.splitlines(keepends=True),
            rewritten.splitlines(keepends=True),
            fromfile=f"a/{path.name}",
            tofile=f"b/{path.name}",
        )
    )
    return {"ok": True, "error": "", "yaml": rewritten, "diff": diff}


def _materialise(entry: Path, declaring: Path, rewritten: str, tmp: Path) -> Path:
    """Copy the harness tree into ``tmp``, apply the proposal there, and return the entry file."""
    import shutil

    root = _harness_root()
    for sibling in root.rglob("*.yaml"):
        target = tmp / sibling.relative_to(root)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(sibling, target)

    (tmp / declaring.relative_to(root)).write_text(rewritten)
    return tmp / entry.relative_to(root)
