"""Lock: retired stacks must not reappear in eectl managed catalog."""

from __future__ import annotations

import runpy
from pathlib import Path

CTRL = Path(__file__).resolve().parents[1] / "eliteew-container-control.py"

_RETIRED = ("stack666", "stack-ewco-pilot")


def test_start_order_excludes_retired_stacks() -> None:
    ns = runpy.run_path(str(CTRL))
    for key in _RETIRED:
        assert key not in ns["START_ORDER"]
        assert key not in ns["STOP_ORDER"]
        assert key not in dict(ns["NAME_PREFIX_TO_STACK_KEY"])
    assert not any(p.startswith("stack666") for p in ns["MANAGED_CONTAINER_PREFIXES"])
    assert "ew-coder-orchestrator" not in ns["MANAGED_CONTAINER_PREFIXES"]


if __name__ == "__main__":
    test_start_order_excludes_retired_stacks()
    print("OK")
