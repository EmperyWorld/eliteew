# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Orchestrator branch: open workflow builder / edit surface from natural-language intent.
# Invariants:
# - Returns ``output_surface`` payload; no LLM call.
# Related:
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# ---

from __future__ import annotations

import re
from typing import Any

_BUILDER_RE = re.compile(
    r"(?ix)(?:"
    r"создай\s+(?:цепочку|автоматизацию|сценарий)|"
    r"настрой\s+(?:цепочку|автоматизацию)|"
    r"конструктор\s+(?:цепоч|воркфло|автомат)|"
    r"create\s+(?:an?\s+)?(?:action\s+)?chain|"
    r"workflow\s+builder|"
    r"build\s+(?:an?\s+)?automation"
    r")",
)

_EDIT_RE = re.compile(
    r"(?ix)(?:"
    r"мои\s+цепоч|"
    r"управлени(?:е|я)\s+цепоч|"
    r"редактир(?:уй|овать)\s+цепоч|"
    r"my\s+(?:action\s+)?chains|"
    r"manage\s+(?:my\s+)?workflows|"
    r"edit\s+(?:my\s+)?workflows"
    r")",
)

_ROADMAP_RE = re.compile(
    r"(?ix)(?:"
    r"покажи\s+(?:мой\s+)?план|"
    r"открой\s+(?:мой\s+)?план|"
    r"roadmap|"
    r"show\s+(?:my\s+)?plan"
    r")",
)


def _looks_cyrillic(text: str) -> bool:
    return bool(re.search(r"[\u0400-\u04FF]", str(text or "")))


def user_line_requests_workflow_builder(user_line: str) -> bool:
    return bool(_BUILDER_RE.search(str(user_line or "")))


def user_line_requests_workflow_edit(user_line: str) -> bool:
    return bool(_EDIT_RE.search(str(user_line or "")))


def user_line_requests_roadmap_surface(user_line: str) -> bool:
    return bool(_ROADMAP_RE.search(str(user_line or "")))


def answer_workflow_surface_intent(user_line: str) -> dict[str, Any] | None:
    """Return orchestrator short-circuit dict with ``output_surface`` or ``None``."""

    line = str(user_line or "").strip()
    if not line:
        return None
    ru = _looks_cyrillic(line)
    if user_line_requests_workflow_builder(line):
        reply = (
            "Открою конструктор цепочки — выберите триггер и действия."
            if ru
            else "Opening the chain builder — pick a trigger and actions."
        )
        return {
            "reply": reply,
            "actions": [],
            "task_run": None,
            "orchestration_branch": "workflow_dag_builder",
            "output_surface": {"mode": "workflow_dag_builder", "payload": {}},
        }
    if user_line_requests_workflow_edit(line):
        reply = (
            "Вот ваши цепочки — можно изменить или отключить." if ru else "Here are your chains — edit or disable them."
        )
        return {
            "reply": reply,
            "actions": [],
            "task_run": None,
            "orchestration_branch": "workflow_edit",
            "output_surface": {"mode": "workflow_edit", "payload": {}},
        }
    if user_line_requests_roadmap_surface(line):
        reply = "Открываю план — цели и шаги ниже." if ru else "Opening your plan — goals and steps below."
        return {
            "reply": reply,
            "actions": [],
            "task_run": None,
            "orchestration_branch": "roadmap_surface",
            "output_surface": {"mode": "roadmap", "payload": {}},
        }
    return None


__all__ = (
    "answer_workflow_surface_intent",
    "user_line_requests_roadmap_surface",
    "user_line_requests_workflow_builder",
    "user_line_requests_workflow_edit",
)
