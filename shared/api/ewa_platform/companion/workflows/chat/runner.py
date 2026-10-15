# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Run named companion workflows (single LLM call, one user-visible reply). No intermediate UI steps.
# Invariants:
# - Returns orchestrator-shaped dict or None (fall through).
# - ``reflect_week`` uses system+user HTTP messages; memory stays in system, never echoed verbatim to user.
# - Workflow LLM calls disable thinking (``enable_thinking: false``) and never surface raw ``reasoning_content``.
# Related:
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# - api/ewa_platform/companion/workflows/chat/registry.py
# ---

from __future__ import annotations

import logging
import os
import re
from collections.abc import Mapping
from datetime import date
from typing import Any

import asyncpg
import httpx

from api.core.unified_config import unified_settings
from api.ewa_platform.companion.config import get_seed_persona_role_prompt
from api.ewa_platform.companion.context.noise import anti_meta_visible_reply, sanitize_context_block_for_llm
from api.ewa_platform.companion.memory.retrieval import compose_memory_window
from api.ewa_platform.companion.observability.degrade_log import companion_degrade_debug
from api.ewa_platform.companion.plans.config import companion_plan_enabled, companion_workflow_enabled
from api.ewa_platform.companion.ux.reply_extract import extract_visible_reply_memory_actions
from api.ewa_platform.companion.workflows.chat.registry import WorkflowId, match_workflow_id
from api.ewa_platform.persistence_pg import companion_plans_asyncpg as plans_pg
from api.utils.llm_json_extract import strip_llm_channel_markup, strip_llm_thinking_prefix
from api.utils.llm_openai_compat_http import httpx_compat_chat_completion_json

logger = logging.getLogger(__name__)

_MEMORY_CONTEXT_MAX = 6000
_MEMORY_HEADER_RE = re.compile(
    r"(?i)^what you remember about us\b|^operator_ground_truth\b|^earlier_conversation_condensed\b"
)
_ROLE_LABEL_LINE_RE = re.compile(r"(?i)^\s*(?:user|assistant|role)\s*[:=]\s*.+$")
_CHATML_LEAK_RE = re.compile(r"(?i)user\s*:\s*el\w*ew\s+role\s*:\s*companion")
_FINAL_POLISH_RE = re.compile(r"(?is)(?:\*\s*)?Final Polish\s*(?:\(Russian\))?\s*:\s*\n(.+)$")
_NUMBERED_LINE_RE = re.compile(r"(?m)^\s*\d+\.\s+(.+)$")
_EN_ANALYSIS_LINE_RE = re.compile(
    r"(?i)^(\*+\s*)?(user message:|context:|intent analysis:|task:|constraints:|refining for|wait,|checking|form a:)"
)


def _cyrillic_letter_ratio(text: str) -> float:
    letters = re.findall(r"[A-Za-zА-Яа-яЁё]", text or "")
    if not letters:
        return 0.0
    cyr = sum(1 for ch in letters if ("А" <= ch <= "я") or ch in "Ёё")
    return cyr / len(letters)


def _workflow_http_llm_options() -> dict[str, Any]:
    """Same anti-CoT guard as main companion chat (llama-server ``reasoning_content`` leak)."""

    return {
        "temperature": 0.35,
        "num_predict": 1024,
        "openai_visible_assistant_content_only": True,
    }


def extract_final_prose_from_llm_reasoning(reasoning: str) -> str:
    """Pull user-visible RU/EN prose from llama-server chain-of-thought when ``content`` is empty."""

    text = (reasoning or "").strip()
    if not text:
        return ""

    match = _FINAL_POLISH_RE.search(text)
    if match:
        block = match.group(1).strip()
        block = re.split(r"(?is)\n\s*\*\s*(?:Refining|Wait,|Checking)", block)[0].strip()
        if _cyrillic_letter_ratio(block) >= 0.2:
            return block

    numbered = [ln.strip() for ln in _NUMBERED_LINE_RE.findall(text)]
    ru_numbered = [ln for ln in numbered if _cyrillic_letter_ratio(ln) >= 0.35 and len(ln) >= 12]
    if len(ru_numbered) >= 2:
        return "\n\n".join(ru_numbered)

    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    for paragraph in reversed(paragraphs):
        if _EN_ANALYSIS_LINE_RE.search(paragraph):
            continue
        if paragraph.startswith("*") and _cyrillic_letter_ratio(paragraph) < 0.35:
            continue
        if _cyrillic_letter_ratio(paragraph) >= 0.35 and len(paragraph) >= 40:
            return paragraph
    return ""


def _visible_text_from_chat_completion_out(out: Mapping[str, Any]) -> tuple[str, str]:
    """Return ``(visible_text, source_tag)`` without surfacing raw CoT reasoning."""

    msg_raw = out.get("message")
    msg = dict(msg_raw) if isinstance(msg_raw, Mapping) else {}
    content = _strip_llm_control_markup(str(msg.get("content") or ""))
    if content:
        return content, "content"
    reasoning = str(msg.get("reasoning_content") or msg.get("reasoning") or msg.get("thinking") or "").strip()
    if reasoning:
        extracted = extract_final_prose_from_llm_reasoning(reasoning)
        if extracted:
            return extracted, "reasoning_extract"
    merged = str(out.get("response") or "").strip()
    if merged and _cyrillic_letter_ratio(merged) >= 0.2 and not _EN_ANALYSIS_LINE_RE.search(merged[:240]):
        return merged, "response"
    return "", "empty"


def _strip_llm_control_markup(raw: str) -> str:
    """Remove Gemma/llama-server ``<|channel>thought`` / ``<channel|>`` control tokens from visible text."""

    return strip_llm_thinking_prefix(strip_llm_channel_markup(raw or "")).strip()


def _looks_cyrillic(text: str) -> bool:
    return bool(re.search(r"[А-Яа-яЁё]", text or ""))


def normalize_reflect_week_memory_section(raw: str) -> str:
    """Strip English HCM scaffolding; keep compact bullet facts for the workflow system block."""

    lines_out: list[str] = []
    for line in (raw or "").splitlines():
        s = line.strip()
        if not s:
            continue
        if _MEMORY_HEADER_RE.search(s):
            continue
        if s.startswith("- — related episodes —"):
            continue
        if s.startswith("### Story /"):
            lines_out.append("Контекст отношений:")
            continue
        s = re.sub(r"^-\s*\[[^\]]+\]\s*", "- ", s)
        lines_out.append(s)
    joined = "\n".join(lines_out).strip()
    if not joined:
        return ""
    return sanitize_context_block_for_llm(joined, max_chars=_MEMORY_CONTEXT_MAX, apply_episode_sanitizer=True)


def sanitize_workflow_visible_reply(raw: str) -> str:
    """User-facing prose only — JSON envelope, meta lines, role labels must not leak."""

    visible, _, _ = extract_visible_reply_memory_actions(_strip_llm_control_markup(raw or ""))
    out = anti_meta_visible_reply(visible)
    cleaned: list[str] = []
    for line in out.splitlines():
        s = line.strip()
        if not s:
            continue
        if _ROLE_LABEL_LINE_RE.match(s):
            continue
        if _CHATML_LEAK_RE.search(s):
            continue
        if _MEMORY_HEADER_RE.search(s):
            continue
        cleaned.append(line)
    return "\n".join(cleaned).strip()


async def _llm_reflect_week_reply(
    *,
    user_line: str,
    memory_context: str,
    profile: Mapping[str, Any] | None,
) -> str | None:
    base_url = str(unified_settings.llama_url or "").strip()
    if not base_url:
        return None
    from api.ewa_platform.companion.prompt_blocks.service import get_prompt_block

    seed = str((profile or {}).get("seed_persona_id") or "parent")
    persona = get_seed_persona_role_prompt(seed)
    looks_ru = _looks_cyrillic(user_line)
    output_rules = get_prompt_block(
        "workflow.reflect_week.output_rules_ru" if looks_ru else "workflow.reflect_week.output_rules_en"
    )
    memory_block = (memory_context or "").strip() or (
        "Нет сохранённого контекста за неделю." if looks_ru else "No saved weekly context."
    )
    task = get_prompt_block("workflow.reflect_week.task")
    system_prompt = f"{persona}\n\n{output_rules}\n\n{task}{memory_block[:_MEMORY_CONTEXT_MAX]}"
    model = (
        os.getenv("EWA_COMPANION_WORKFLOW_MODEL", "").strip()
        or os.getenv("EWA_COMPANION_CHAT_MODEL", "").strip()
        or "default"
    )
    timeout = httpx.Timeout(90.0, connect=10.0)
    async with httpx.AsyncClient() as client:
        out = await httpx_compat_chat_completion_json(
            client,
            base_url,
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_line[:4000]},
            ],
            options=_workflow_http_llm_options(),
            chat_template_kwargs={"enable_thinking": False},
            extra_params={"reasoning_format": "none"},
            timeout=timeout,
        )
    raw, source = _visible_text_from_chat_completion_out(out)
    text = sanitize_workflow_visible_reply(raw)
    if text:
        logger.info("[STEP] companion_workflow_reflect_llm_reply source=%s chars=%d", source, len(text))
    elif source == "empty":
        logger.info("[STEP] companion_workflow_reflect_llm_reply source=empty")
    return text or None


async def _build_reflect_week_memory_context(
    pool: asyncpg.Pool | None,
    *,
    principal_id: str | None,
    profile: Mapping[str, Any] | None,
    user_line: str,
) -> str:
    """Compact HCM + active plan tasks for reflect_week (no extra LLM)."""

    blocks: list[str] = []
    if pool is not None and principal_id and isinstance(profile, Mapping):
        persona = str(profile.get("seed_persona_id") or "parent")
        try:
            window = await compose_memory_window(
                profile=profile,
                principal_id=principal_id,
                current_user_text=user_line,
                persona=persona,
                pool=pool,
                episodic_top_k=8,
            )
            section = normalize_reflect_week_memory_section(str(getattr(window, "prompt_section", "") or ""))
            if section:
                blocks.append(section)
        except Exception as exc:  # noqa: BLE001
            companion_degrade_debug(
                logger,
                "workflow_reflect_memory",
                "reflect_week memory window compose failed",
                exc=exc,
                principal_id=principal_id,
            )

        if companion_plan_enabled():
            try:
                tasks = await plans_pg.plan_list_open_tasks(pool, principal_id=principal_id, limit=5)
            except Exception as exc:  # noqa: BLE001
                companion_degrade_debug(
                    logger,
                    "workflow_reflect_plan_tasks",
                    "reflect_week plan open tasks load failed",
                    exc=exc,
                    principal_id=principal_id,
                )
                tasks = []
            if tasks:
                today = date.today()
                lines: list[str] = []
                for row in tasks:
                    title = str(row.get("title") or "").strip()
                    if not title:
                        continue
                    due = row.get("due_date")
                    due_note = ""
                    if isinstance(due, date):
                        due_note = f" (до {due.isoformat()})" if due >= today else f" (просрочено с {due.isoformat()})"
                    lines.append(f"- {title}{due_note}")
                if lines:
                    blocks.append("Открытые шаги активного плана:\n" + "\n".join(lines))

    if not blocks:
        return "Нет сохранённого контекста за неделю."
    return "\n\n".join(blocks)


async def try_workflow_orchestration_reply(
    user_line: str,
    *,
    shell_norm: Mapping[str, Any] | None = None,
    pool: asyncpg.Pool | None = None,
    principal_id: str | None = None,
    profile: Mapping[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Return short-circuit orchestration response when a workflow handles the line."""

    _ = shell_norm  # reserved for file_focus
    wf = match_workflow_id(user_line)
    if wf is None:
        return None
    if not companion_workflow_enabled(str(wf.value)):
        return None
    if wf == WorkflowId.REFLECT_WEEK:
        memory_context = await _build_reflect_week_memory_context(
            pool,
            principal_id=principal_id,
            profile=profile,
            user_line=user_line,
        )
        reply = await _llm_reflect_week_reply(
            user_line=user_line,
            memory_context=memory_context,
            profile=profile,
        )
        if not reply:
            return None
        logger.info("[STEP] companion_workflow_complete workflow_id=reflect_week")
        return {
            "reply": reply,
            "actions": [],
            "task_run": None,
            "orchestration_branch": "workflow_reflect_week",
        }
    return None


__all__ = (
    "extract_final_prose_from_llm_reasoning",
    "normalize_reflect_week_memory_section",
    "sanitize_workflow_visible_reply",
    "try_workflow_orchestration_reply",
)
