# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Offline eval harness for ensemble routing heuristics against golden fixtures.
# Invariants:
# - Heuristic-only (no LLM) for deterministic CI; LLM classifier cases belong in separate harness.
# Related:
# - api/services/desktop_chat_ensemble/conversational_route.py
# - api/tests/fixtures/desktop_chat_route_eval_golden.jsonl
# ---

"""Golden-set evaluation for desktop ensemble route heuristics."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

from api.services.desktop_chat_ensemble.conversational_route import (
    RoutePhase,
    heuristic_ensemble_route_phase,
)

DEFAULT_GOLDEN_PATH = (
    Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "desktop_chat_route_eval_golden.jsonl"
)


@dataclass(frozen=True, slots=True)
class RouteEvalCase:
    id: str
    user_text: str
    expect_phase: RoutePhase
    tags: tuple[str, ...]
    history: tuple[dict[str, Any], ...]


@dataclass(frozen=True, slots=True)
class RouteEvalMismatch:
    case_id: str
    expected: RoutePhase
    actual: RoutePhase
    user_text: str


@dataclass(frozen=True, slots=True)
class RouteEvalReport:
    total: int
    passed: int
    mismatches: tuple[RouteEvalMismatch, ...]

    @property
    def accuracy(self) -> float:
        if self.total <= 0:
            return 1.0
        return self.passed / self.total


def _history_from_rows(rows: tuple[dict[str, Any], ...]) -> list[SimpleNamespace]:
    out: list[SimpleNamespace] = []
    for row in rows:
        role = str(row.get("role") or "user")
        content = str(row.get("content") or "")
        meta = row.get("metadata")
        message_metadata = dict(meta) if isinstance(meta, dict) else {}
        out.append(
            SimpleNamespace(
                id=uuid4(),
                role=role,
                content=content,
                message_metadata=message_metadata,
            )
        )
    return out


def load_route_eval_cases(path: Path | None = None) -> list[RouteEvalCase]:
    golden_path = path or DEFAULT_GOLDEN_PATH
    cases: list[RouteEvalCase] = []
    for line in golden_path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text:
            continue
        row = json.loads(text)
        case_id = str(row.get("id") or "").strip()
        user_text = str(row.get("user_text") or "")
        expect_raw = str(row.get("expect_phase") or "").strip()
        if expect_raw not in ("blueprint", "legacy", "uncertain"):
            raise ValueError(f"invalid expect_phase in case {case_id!r}")
        expect_phase = expect_raw  # type: ignore[assignment]
        raw_tags = row.get("tags")
        tags: tuple[str, ...] = ()
        if isinstance(raw_tags, list):
            tags = tuple(str(x).strip() for x in raw_tags if str(x).strip())
        raw_hist = row.get("history")
        history: tuple[dict[str, Any], ...] = ()
        if isinstance(raw_hist, list):
            history = tuple(item for item in raw_hist if isinstance(item, dict))
        if not case_id:
            raise ValueError("route eval case missing id")
        cases.append(
            RouteEvalCase(
                id=case_id,
                user_text=user_text,
                expect_phase=expect_phase,
                tags=tags,
                history=history,
            )
        )
    return cases


def evaluate_route_heuristics(
    cases: list[RouteEvalCase],
    *,
    defaults: dict[str, Any] | None = None,
) -> RouteEvalReport:
    cfg = defaults if isinstance(defaults, dict) else {}
    mismatches: list[RouteEvalMismatch] = []
    passed = 0
    for case in cases:
        history = _history_from_rows(case.history) if case.history else None
        actual = heuristic_ensemble_route_phase(
            user_text=case.user_text,
            defaults=cfg,
            history=history,
        )
        if actual == case.expect_phase:
            passed += 1
            continue
        mismatches.append(
            RouteEvalMismatch(
                case_id=case.id,
                expected=case.expect_phase,
                actual=actual,
                user_text=case.user_text,
            )
        )
    return RouteEvalReport(total=len(cases), passed=passed, mismatches=tuple(mismatches))
