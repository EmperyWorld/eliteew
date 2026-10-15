# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Fast regex/intent gates before expensive orchestrator tool probes — skip branches that cannot match the user line.
# Invariants:
# - False negative is acceptable (branch skipped → LLM may still help); false positive only runs existing handler.
# - Tool-router bypass lines always probe (router sets ``_tool_router_bypass_line_match`` on args separately).
# Related:
# - api/ewa_platform/companion/orchestration/task_orchestrator.py
# - api/ewa_platform/companion/sidecar/tool_router.py
# ---

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

from api.ewa_platform.companion.ux.chit_chat import is_trivial_chit_chat_user_line

_LATE_DOC_CREATE_RE = re.compile(
    r"(?is)(?:"
    r"(?:создай|создать|сделай|сгенерируй|create|make|new).{0,80}"
    r"(?:файл|документ|заметк|document|file|note)"
    r"|(?:новый|новую|новое)\s+(?:файл|документ|заметк|document|file|note)"
    r")"
)
_LATE_FILE_RENAME_RU = re.compile(r"(?is)(?:переименуй|переименовать)\s+(?:файл|документ)?\s*.+\s+в\s+.+$")
_LATE_FILE_RENAME_EN = re.compile(r"(?is)\brename\s+(?:file|document)?\s*.+\s+to\s+.+$")
_LATE_FILE_DELETE_RU = re.compile(r"(?is)(?:удали|удалить)\s+(?:файл|документ)?\s*.+$")
_LATE_FILE_DELETE_EN = re.compile(r"(?is)\b(?:delete|remove)\s+(?:file|document)?\s*.+$")
_LATE_DOC_INSERT_RE = re.compile(
    r"(?is)(?:встав|добав|помест|insert|append).{0,80}(?:файл|file).{0,120}(?:документ|редактор|editor|document)"
)
_CATALOG_LIST_RE = re.compile(
    r"(?ix)(?:"
    r"(?:покаж(?:и|ите)|посмотри|выведи|дай|перечисли)\s+(?:мне\s+)?(?:список\s+)?"
    r"(?:всех\s+)?(?:моих\s+)?(?:мои\s+)?(?:файл|файлы|файлов|документ|документы|документов|каталог)|"
    r"(?:список|перечень)\s+(?:всех\s+)?(?:моих\s+)?(?:файл|файлов|документ|документов)|"
    r"(?:find|search|list|show|display)\s+(?:me\s+)?(?:all\s+)?(?:my\s+)?(?:files|documents|catalog)|"
    r"что\s+(?:у\s+меня|есть)\s+в\s+(?:каталог|файл)"
    r")"
)


def user_line_may_match_late_file_ops(user_line: str) -> bool:
    """True when ``file_create`` / rename / delete / ``doc_insert`` might handle the line."""

    s = (user_line or "").strip()
    if not s:
        return False
    if _LATE_DOC_CREATE_RE.search(s):
        return True
    if _LATE_FILE_RENAME_RU.search(s) or _LATE_FILE_RENAME_EN.search(s):
        return True
    if _LATE_FILE_DELETE_RU.search(s) or _LATE_FILE_DELETE_EN.search(s):
        return True
    return _LATE_DOC_INSERT_RE.search(s) is not None


def user_line_may_probe_tool_router(user_line: str) -> bool:
    """Skip Tool Router sidecar on obvious chit-chat (saves stack2 round-trip)."""

    if is_trivial_chit_chat_user_line(user_line):
        return False
    return bool((user_line or "").strip())


def early_tool_branch_may_probe(
    branch_name: str,
    user_line: str,
    profile: Mapping[str, Any] | None,
    *,
    principal_id: str = "",
) -> bool:
    """Cheap pre-check before ``dispatch_tool_by_name`` for early orchestrator branches."""

    s = (user_line or "").strip()
    if not s:
        return False
    name = (branch_name or "").strip()
    if name == "check_task_status":
        from api.ewa_platform.companion.orchestration.check_task_status import (
            user_line_requests_check_task_status,
        )

        return user_line_requests_check_task_status(s)
    if name == "operations_status":
        from api.ewa_platform.companion.orchestration.active_task_runs_prompt import (
            user_line_asks_active_operations_status,
        )

        return user_line_asks_active_operations_status(s)
    if name == "operation_cancel":
        return bool(
            re.search(
                r"(?ix)(?:"
                r"(?:отмен(?:и|ить)|останов(?:и|ить)|прекрат(?:и|ить))\s+"
                r"(?:текущ\w*\s+)?(?:операц\w*|задач\w*|генерац\w*|run|таск)|"
                r"(?:cancel|stop|abort)\s+(?:the\s+)?(?:current\s+)?(?:operation|task|run|generation)"
                r")",
                s,
            )
        )
    if name == "plan_task_complete_v1":
        from api.ewa_platform.companion.plans.task_complete_intent import (
            user_line_requests_plan_task_complete,
        )

        return user_line_requests_plan_task_complete(s)
    if name == "theme_set":
        from api.ewa_platform.companion.ux.desktop_theme_inference import infer_theme_from_user_line

        pid = (principal_id or str((profile or {}).get("principal_id") or "")).strip()
        return infer_theme_from_user_line(s, principal_id=pid or "unknown") is not None
    if name == "plan_v1":
        from api.ewa_platform.companion.plans.intent import user_line_requests_plan
        from api.ewa_platform.companion.plans.refine_intent import user_line_requests_plan_refine
        from api.ewa_platform.companion.plans.time import user_line_requests_plan_time_adjustment

        return (
            user_line_requests_plan(s)
            or user_line_requests_plan_refine(s)
            or user_line_requests_plan_time_adjustment(s)
        )
    if name == "calendar_v1":
        from api.ewa_platform.companion.calendar.intent import (
            user_line_requests_calendar_create,
            user_line_requests_calendar_list,
        )

        return user_line_requests_calendar_list(s) or user_line_requests_calendar_create(s)
    if name == "catalog_discuss":
        from api.ewa_platform.companion.orchestration.companion_social_post_compose import (
            user_line_requests_social_post_compose,
        )
        from api.ewa_platform.companion.storage.catalog_file_discuss import (
            catalog_file_discuss_env_enabled,
            user_intent_catalog_file_discuss,
            user_intent_catalog_file_discuss_deictic,
        )

        if user_line_requests_social_post_compose(s):
            return False
        if not catalog_file_discuss_env_enabled():
            return False
        return user_intent_catalog_file_discuss(s) or user_intent_catalog_file_discuss_deictic(s, profile)
    if name == "social_post_compose":
        from api.ewa_platform.companion.orchestration.companion_social_post_compose import (
            companion_social_post_compose_enabled,
            user_line_requests_social_post_compose,
        )

        return companion_social_post_compose_enabled() and user_line_requests_social_post_compose(s)
    if name == "catalog_list":
        return _CATALOG_LIST_RE.search(s) is not None
    if name == "file_rewrite":
        from api.ewa_platform.companion.server_first.v2 import (
            companion_user_intent_server_first_v2_full_replace,
            server_first_v2_env_enabled,
        )

        return server_first_v2_env_enabled() and companion_user_intent_server_first_v2_full_replace(s)
    if name == "music_generation_xl_base":
        from api.ewa_platform.companion.orchestration.companion_music_xl_base import (
            user_line_requests_music_xl_base_autonomous,
        )

        return user_line_requests_music_xl_base_autonomous(s, profile)
    if name == "music_xl_base_interactive":
        from api.ewa_platform.companion.orchestration.companion_music_xl_base import (
            user_line_requests_music_xl_base_interactive,
        )

        return user_line_requests_music_xl_base_interactive(s)
    if name == "music_generation":
        from api.ewa_platform.companion.orchestration.tool_registry import _user_line_requests_music_creation

        return _user_line_requests_music_creation(s, profile)
    if name == "image_generation":
        from api.ewa_platform.companion.orchestration.companion_image_generation import (
            user_line_requests_image_generation,
        )

        return user_line_requests_image_generation(s)
    if name == "presentation_generation":
        from api.ewa_platform.companion.orchestration.companion_presentation_generation import (
            user_line_requests_presentation_generation,
        )

        return user_line_requests_presentation_generation(s)
    if name == "music_studio_open":
        low = s.lower()
        return any(
            k in low
            for k in (
                "music studio",
                "music generator",
                "музыкальн",
                "генератор муз",
                "musicgenerator",
            )
        )
    if name == "file_open":
        from api.ewa_platform.companion.storage.doceditor_content_resolve import user_line_may_probe_file_open

        return user_line_may_probe_file_open(s)
    if name == "app_open":
        low = s.lower()
        return any(
            k in low
            for k in (
                "открой",
                "open ",
                "launch ",
                "запусти",
                "content manager",
                "doceditor",
                "musicgenerator",
            )
        )
    return True


__all__ = (
    "early_tool_branch_may_probe",
    "user_line_may_match_late_file_ops",
    "user_line_may_probe_tool_router",
)
