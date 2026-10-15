# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Generate or refine survey drafts via stack2 LLM (JSON object response).
# Invariants:
# - Output normalized to survey_validation QUESTION_TYPES before returning to admin UI.
# Related:
# - api/routers/product_desktop_surveys.py
# - documentation/product/SURVEY-HUB.md
# ---

from __future__ import annotations

import json
import logging
import re
from typing import Any, Literal

import httpx

from api.core.unified_config import unified_settings
from api.services.surveys.survey_validation import QUESTION_TYPES
from api.utils.llama_keep_alive import llama_keep_alive_from_settings
from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json

logger = logging.getLogger(__name__)

_SURVEY_AI_MODEL_ENV = "SURVEY_AI_LLM_MODEL"
_MAX_BRIEF_LEN = 20_000
_MAX_QUESTIONS = 24

_SYSTEM_PROMPT = """You design surveys for EliteEW Survey Hub.
Return ONLY one JSON object. No markdown fences, no commentary.

Schema:
{
  "title": "string (required, max 500 chars)",
  "description_user": "string (user-facing intro, max 8000)",
  "description_admin": "string or null (operator notes)",
  "gaf_notify_body_template": "string or null (short GAF chat announcement, max 2000)",
  "reward": {"ugs_credits": 0, "ew_balance": 0, "web_search_coins": 0},
  "questions": [
    {
      "question_key": "snake_case_latin unique",
      "question_type": "single_choice|multi_choice|scale|yes_no|text_short|text_long|nps",
      "prompt": "question text",
      "required": true,
      "choices": ["only for single_choice and multi_choice, 2-8 items"]
    }
  ]
}

Rules:
- Use the same language as the operator brief for title, descriptions, prompts, choices.
- question_key: lowercase snake_case, latin letters/digits/underscore, max 64 chars, unique.
- Prefer 4-10 focused questions unless the brief asks otherwise.
- scale implies values 1-5; nps implies 0-10; do not add choices for scale/nps/yes_no/text types.
- yes_no questions need no choices.
- reward numbers must be non-negative integers; default all zeros unless brief mentions rewards.
"""


def _extract_json_object(raw: str) -> dict[str, Any]:
    text = (raw or "").strip()
    if not text:
        msg = "LLM returned empty response"
        raise ValueError(msg)
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
    if fence:
        text = fence.group(1).strip()
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        try:
            parsed = json.loads(text[start : end + 1])
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError as exc:
            msg = f"Could not parse LLM JSON: {exc}"
            raise ValueError(msg) from exc
    msg = "LLM response is not a JSON object"
    raise ValueError(msg)


def _slug_key(seed: str, index: int) -> str:
    base = re.sub(r"[^a-z0-9_]+", "_", (seed or "").lower()).strip("_")
    if not base:
        base = f"q_{index + 1}"
    return base[:64]


def _normalize_question_type(raw: Any) -> str:
    val = str(raw or "text_short").strip().lower()
    aliases = {
        "single": "single_choice",
        "multi": "multi_choice",
        "text": "text_short",
        "long_text": "text_long",
        "short_text": "text_short",
        "boolean": "yes_no",
        "bool": "yes_no",
    }
    val = aliases.get(val, val)
    if val not in QUESTION_TYPES:
        return "text_short"
    return val


def _normalize_reward(raw: Any) -> dict[str, int]:
    src = raw if isinstance(raw, dict) else {}
    out: dict[str, int] = {}
    for key in ("ugs_credits", "ew_balance", "web_search_coins"):
        try:
            out[key] = max(0, int(src.get(key, 0) or 0))
        except TypeError, ValueError:
            out[key] = 0
    return out


def normalize_survey_ai_draft(raw: dict[str, Any]) -> dict[str, Any]:
    """Map LLM JSON to admin-safe draft dict."""
    title = str(raw.get("title") or "").strip()
    if not title:
        msg = "LLM draft missing title"
        raise ValueError(msg)

    questions_in = raw.get("questions")
    if not isinstance(questions_in, list) or not questions_in:
        msg = "LLM draft must include at least one question"
        raise ValueError(msg)

    seen_keys: set[str] = set()
    questions_out: list[dict[str, Any]] = []

    for idx, item in enumerate(questions_in[:_MAX_QUESTIONS]):
        if not isinstance(item, dict):
            continue
        prompt = str(item.get("prompt") or "").strip()
        if not prompt:
            continue
        qtype = _normalize_question_type(item.get("question_type"))
        seed_key = str(item.get("question_key") or prompt[:32] or f"q_{idx + 1}")
        key = _slug_key(seed_key, idx)
        suffix = 2
        while key in seen_keys:
            key = _slug_key(f"{seed_key}_{suffix}", idx)
            suffix += 1
        seen_keys.add(key)

        options: dict[str, Any] = {}
        choices_raw = item.get("choices")
        if qtype in ("single_choice", "multi_choice"):
            choices = [str(c).strip() for c in (choices_raw or []) if str(c).strip()]
            if len(choices) < 2:
                choices = ["Да", "Нет"] if qtype == "single_choice" else ["Вариант 1", "Вариант 2"]
            options["choices"] = choices[:12]
        elif qtype == "scale":
            options = {"min": 1, "max": 5}
        elif qtype == "nps":
            options = {"min": 0, "max": 10}

        questions_out.append(
            {
                "question_key": key,
                "question_type": qtype,
                "prompt": prompt[:4000],
                "help_text": None,
                "required": bool(item.get("required", True)),
                "sort_order": len(questions_out),
                "options_json": options,
                "validation_json": {},
            }
        )

    if not questions_out:
        msg = "No valid questions after normalization"
        raise ValueError(msg)

    gaf = raw.get("gaf_notify_body_template")
    gaf_str = str(gaf).strip()[:2000] if gaf else None

    desc_admin = raw.get("description_admin")
    desc_admin_str = str(desc_admin).strip()[:8000] if desc_admin else None

    return {
        "title": title[:500],
        "description_user": str(raw.get("description_user") or "").strip()[:8000],
        "description_admin": desc_admin_str,
        "gaf_notify_body_template": gaf_str or None,
        "reward": _normalize_reward(raw.get("reward")),
        "questions": questions_out,
    }


def _resolve_model() -> str:
    import os

    explicit = (os.environ.get(_SURVEY_AI_MODEL_ENV) or "").strip()
    if explicit:
        return explicit
    return str(unified_settings.default_ai_model or "default")


def _build_user_prompt(
    *,
    mode: Literal["create", "refine"],
    brief: str,
    draft: dict[str, Any] | None,
    supplement: str | None,
) -> str:
    if mode == "refine" and draft:
        parts = [
            "Refine the existing survey draft using the operator instructions.",
            "Keep valid question_keys when possible; you may add/remove/reword questions.",
            f"Operator supplement:\n{(supplement or brief).strip()}",
            "Current draft JSON:",
            json.dumps(draft, ensure_ascii=False, indent=2),
        ]
        return "\n\n".join(parts)
    return f"Create a new survey draft from this operator brief:\n\n{brief.strip()}"


async def generate_survey_ai_draft(
    *,
    brief: str,
    mode: Literal["create", "refine"] = "create",
    draft: dict[str, Any] | None = None,
    supplement: str | None = None,
) -> dict[str, Any]:
    text = (brief or "").strip()
    if len(text) < 10:
        msg = "Brief must be at least 10 characters"
        raise ValueError(msg)
    if len(text) > _MAX_BRIEF_LEN:
        msg = f"Brief exceeds {_MAX_BRIEF_LEN} characters"
        raise ValueError(msg)
    if mode == "refine" and not draft:
        msg = "Refine mode requires an existing draft"
        raise ValueError(msg)

    base_url = unified_settings.llama_url.rstrip("/")
    model = _resolve_model()
    user_prompt = _build_user_prompt(mode=mode, brief=text, draft=draft, supplement=supplement)

    logger.info("[STEP] survey_ai_draft_start mode=%s model=%s base_url=%s", mode, model, base_url)

    async with httpx.AsyncClient(timeout=httpx.Timeout(180.0, connect=15.0)) as client:
        try:
            data = await httpx_compat_chat_completion_json(
                client,
                base_url,
                model=model,
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                options={"temperature": 0.35, "num_predict": 8192},
                keep_alive=llama_keep_alive_from_settings(),
                timeout=client.timeout,
                response_format={"type": "json_object"},
            )
        except Exception as exc:
            logger.warning("[STEP] survey_ai_draft_llm_fail err=%s", exc)
            msg = "Survey AI service unavailable — check stack2 LLM on prod-core"
            raise RuntimeError(msg) from exc

    raw_text = str(data.get("response") or "").strip()
    parsed = _extract_json_object(raw_text)
    normalized = normalize_survey_ai_draft(parsed)
    logger.info(
        "[STEP] survey_ai_draft_ok mode=%s questions=%s",
        mode,
        len(normalized.get("questions") or []),
    )
    return normalized
