# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Offline eval harness for desktop prompt composition against golden fixtures.
# Invariants:
# - Deterministic compose-only checks (no LLM); golden must_contain strings are substrings.
# Related:
# - api/services/desktop_chat/prompt_compose.py
# - api/tests/fixtures/desktop_chat_prompt_eval_golden.jsonl
# ---

"""Golden-set evaluation for desktop AI Chat prompt composition."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from api.services.desktop_chat.prompt_compose import (
    DesktopPromptMode,
    compose_desktop_system_prompt_with_meta,
)

DEFAULT_GOLDEN_PATH = (
    Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "desktop_chat_prompt_eval_golden.jsonl"
)

_VALID_MODES: frozenset[str] = frozenset({"solo", "ensemble_speaker", "ensemble_short", "blueprint"})


@dataclass(frozen=True, slots=True)
class PromptEvalCase:
    id: str
    hero_id: str | None
    mode: DesktopPromptMode
    defaults: dict[str, Any]
    use_tools: bool
    chat_override: str | None
    structured_reply: bool
    post_tool: bool
    must_contain: tuple[str, ...]
    must_not_contain: tuple[str, ...]
    expect_source: str | None
    expect_mode: DesktopPromptMode | None
    tags: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class PromptEvalMismatch:
    case_id: str
    reason: str


@dataclass(frozen=True, slots=True)
class PromptEvalReport:
    total: int
    passed: int
    mismatches: tuple[PromptEvalMismatch, ...]

    @property
    def accuracy(self) -> float:
        if self.total <= 0:
            return 1.0
        return self.passed / self.total


def load_prompt_eval_cases(path: Path | None = None) -> list[PromptEvalCase]:
    golden_path = path or DEFAULT_GOLDEN_PATH
    cases: list[PromptEvalCase] = []
    for line in golden_path.read_text(encoding="utf-8").splitlines():
        text = line.strip()
        if not text:
            continue
        row = json.loads(text)
        case_id = str(row.get("id") or "").strip()
        if not case_id:
            raise ValueError("prompt eval case missing id")
        mode_raw = str(row.get("mode") or "solo").strip()
        if mode_raw not in _VALID_MODES:
            raise ValueError(f"invalid mode in case {case_id!r}")
        mode = mode_raw  # type: ignore[assignment]
        hero_raw = row.get("hero_id")
        hero_id = str(hero_raw).strip() if isinstance(hero_raw, str) and hero_raw.strip() else None
        defaults_raw = row.get("defaults")
        defaults = dict(defaults_raw) if isinstance(defaults_raw, dict) else {}
        use_tools = bool(row.get("use_tools"))
        structured_reply = bool(row.get("structured_reply"))
        post_tool = bool(row.get("post_tool"))
        override_raw = row.get("chat_override")
        chat_override = str(override_raw) if isinstance(override_raw, str) else None
        must_contain = _tuple_from_str_list(row.get("must_contain"))
        must_not_contain = _tuple_from_str_list(row.get("must_not_contain"))
        expect_source_raw = row.get("expect_source")
        expect_source = (
            str(expect_source_raw).strip() if isinstance(expect_source_raw, str) and expect_source_raw.strip() else None
        )
        expect_mode_raw = row.get("expect_mode")
        expect_mode: DesktopPromptMode | None = None
        if isinstance(expect_mode_raw, str) and expect_mode_raw.strip() in _VALID_MODES:
            expect_mode = expect_mode_raw.strip()  # type: ignore[assignment]
        raw_tags = row.get("tags")
        tags: tuple[str, ...] = ()
        if isinstance(raw_tags, list):
            tags = tuple(str(x).strip() for x in raw_tags if str(x).strip())
        cases.append(
            PromptEvalCase(
                id=case_id,
                hero_id=hero_id,
                mode=mode,
                defaults=defaults,
                use_tools=use_tools,
                chat_override=chat_override,
                structured_reply=structured_reply,
                post_tool=post_tool,
                must_contain=must_contain,
                must_not_contain=must_not_contain,
                expect_source=expect_source,
                expect_mode=expect_mode,
                tags=tags,
            )
        )
    return cases


def _tuple_from_str_list(raw: Any) -> tuple[str, ...]:
    if not isinstance(raw, list):
        return ()
    return tuple(str(x) for x in raw if str(x))


def evaluate_prompt_compose(cases: list[PromptEvalCase]) -> PromptEvalReport:
    mismatches: list[PromptEvalMismatch] = []
    passed = 0
    for case in cases:
        prompt, meta = compose_desktop_system_prompt_with_meta(
            hero_id=case.hero_id,
            mode=case.mode,
            defaults=case.defaults,
            use_tools=case.use_tools,
            chat_override=case.chat_override,
            structured_reply=case.structured_reply,
            post_tool=case.post_tool,
        )
        failure = _check_case(case, prompt, meta)
        if failure is None:
            passed += 1
        else:
            mismatches.append(PromptEvalMismatch(case_id=case.id, reason=failure))
    return PromptEvalReport(total=len(cases), passed=passed, mismatches=tuple(mismatches))


def _check_case(case: PromptEvalCase, prompt: str, meta: dict[str, Any]) -> str | None:
    for needle in case.must_contain:
        if needle not in prompt:
            return f"missing substring {needle!r} in prompt"
    for forbidden in case.must_not_contain:
        if forbidden in prompt:
            return f"forbidden substring {forbidden!r} present in prompt"
    if case.expect_source is not None and meta.get("desktop_prompt_source") != case.expect_source:
        return f"source mismatch: expected {case.expect_source!r} actual {meta.get('desktop_prompt_source')!r}"
    if case.expect_mode is not None and meta.get("desktop_prompt_mode") != case.expect_mode:
        return f"mode mismatch: expected {case.expect_mode!r} actual {meta.get('desktop_prompt_mode')!r}"
    if not meta.get("desktop_prompt_hash"):
        return "missing desktop_prompt_hash in metadata"
    return None
