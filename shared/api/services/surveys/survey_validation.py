# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Survey answer validation against question schema (server-side contract).
# Invariants:
# - All submit paths must validate before persisting survey_responses.
# Related:
# - api/services/surveys/survey_service.py
# ---

from __future__ import annotations

from typing import Any


class SurveyValidationError(ValueError):
    """Invalid survey answers for a question schema."""


QUESTION_TYPES = frozenset(
    {
        "single_choice",
        "multi_choice",
        "scale",
        "yes_no",
        "text_short",
        "text_long",
        "nps",
    }
)


def validate_answers_for_questions(
    questions: list[dict[str, Any]],
    answers: dict[str, Any],
) -> dict[str, Any]:
    """Return normalized answers dict or raise SurveyValidationError."""
    normalized: dict[str, Any] = {}
    for q in questions:
        key = str(q.get("question_key") or "")
        if not key:
            continue
        qtype = str(q.get("question_type") or "")
        required = bool(q.get("required", True))
        options = q.get("options_json") or {}
        validation = q.get("validation_json") or {}
        raw = answers.get(key)
        if raw is None or raw == "" or raw == []:
            if required:
                raise SurveyValidationError(f"Missing required answer: {key}")
            continue
        normalized[key] = _validate_one(qtype, raw, options, validation, key)
    return normalized


def _validate_one(
    qtype: str,
    raw: Any,
    options: dict[str, Any],
    validation: dict[str, Any],
    key: str,
) -> Any:
    if qtype == "single_choice":
        choice = str(raw)
        choices = [str(c) for c in (options.get("choices") or [])]
        if choices and choice not in choices:
            raise SurveyValidationError(f"Invalid choice for {key}")
        return choice
    if qtype == "multi_choice":
        if not isinstance(raw, list):
            raise SurveyValidationError(f"Expected list for {key}")
        choices = [str(c) for c in (options.get("choices") or [])]
        picked = [str(x) for x in raw]
        if choices and any(p not in choices for p in picked):
            raise SurveyValidationError(f"Invalid multi choice for {key}")
        return picked
    if qtype == "yes_no":
        if raw not in (True, False, "yes", "no", "true", "false", 1, 0):
            raise SurveyValidationError(f"Invalid yes/no for {key}")
        return raw in (True, "yes", "true", 1)
    if qtype in ("scale", "nps"):
        try:
            num = int(raw)
        except (TypeError, ValueError) as exc:
            raise SurveyValidationError(f"Expected number for {key}") from exc
        lo = int(options.get("min", validation.get("min", 0 if qtype == "nps" else 1)))
        hi = int(options.get("max", validation.get("max", 10 if qtype == "nps" else 5)))
        if num < lo or num > hi:
            raise SurveyValidationError(f"Out of range for {key}")
        return num
    if qtype == "text_short":
        text = str(raw).strip()
        max_len = int(validation.get("max_length", 500))
        if len(text) > max_len:
            raise SurveyValidationError(f"Text too long for {key}")
        return text
    if qtype == "text_long":
        text = str(raw).strip()
        max_len = int(validation.get("max_length", 5000))
        if len(text) > max_len:
            raise SurveyValidationError(f"Text too long for {key}")
        return text
    raise SurveyValidationError(f"Unknown question type for {key}: {qtype}")
