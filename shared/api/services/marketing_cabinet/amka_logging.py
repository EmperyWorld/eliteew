"""Grep-friendly AMKA log lines: single prefix, event=, run_id=, step_id=."""

from __future__ import annotations

from typing import Any


def amka_log_line(
    event: str,
    *,
    run_id: Any = None,
    step_id: Any = None,
    section: str | None = None,
    project_id: Any = None,
    user_id: Any = None,
    **extra: Any,
) -> str:
    """Build one line: ``[AMKA] event=...`` plus stable key=value pairs for tracing."""
    parts: list[str] = ["[AMKA]", f"event={event}"]
    if run_id is not None:
        parts.append(f"run_id={run_id}")
    if step_id is not None:
        parts.append(f"step_id={step_id}")
    if section:
        parts.append(f"section={section}")
    if project_id is not None:
        parts.append(f"project_id={project_id}")
    if user_id is not None:
        parts.append(f"user_id={user_id}")
    for key in sorted(extra):
        val = extra[key]
        if val is None:
            continue
        parts.append(f"{key}={val}")
    return " ".join(parts)
