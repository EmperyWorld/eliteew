# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Explicit folder create/reuse intent for companion file_create / file_save_text.
# Invariants:
# - Default write target is EwaFile root (no auto per-session / per-run folder).
# - Nested ``ewa-task-*`` folders only when the user or tool_args explicitly ask.
# Related:
# - api/services/ewa_task_folder_service.py
# - api/utils/ewa_task_folder.py
# - documentation/product/ewa/EWA-COMPANION-FILE-CATALOG.md
# ---

from __future__ import annotations

import hashlib
import logging
import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal

from api.utils.ewa_task_folder import (
    is_ewa_task_folder_item_id,
    sanitize_ewa_task_folder_label,
)

logger = logging.getLogger(__name__)

FolderWriteMode = Literal["root", "create", "reuse"]

_CREATE_FOLDER_RE = re.compile(
    r"(?is)(?:создай|создать|сделай|заведи)\s+(?:новую\s+)?папк[уие]\s*"
    r"[«\"']?([^»\"'\n,.;:!?]{1,80})?",
)
_CREATE_FOLDER_EN_RE = re.compile(
    r"(?is)create\s+(?:a\s+)?(?:new\s+)?folder\s*[«\"']?([^»\"'\n,.;:!?]{1,80})?",
)
_IN_NEW_FOLDER_RE = re.compile(
    r"(?is)в\s+новой\s+папк[еу]\s*[«\"']?([^»\"'\n,.;:!?]{1,80})?",
)
_REUSE_QUOTED_RE = re.compile(
    r"(?is)(?:в|во|из)\s+(?:существующ\w*\s+)?папк[еуи]\s*[«\"']([^»\"']{1,80})[»\"']",
)
_REUSE_BARE_RE = re.compile(
    r"(?is)(?:в|во)\s+(?:существующ\w*\s+)?папк[еуи]\s+"
    r"([A-Za-zА-Яа-яЁё0-9][\w\u0400-\u04ff\- ]{0,60})",
)
_REUSE_EN_RE = re.compile(
    r"(?is)(?:in|into|use|reuse|open)\s+(?:the\s+)?(?:existing\s+)?folder\s*"
    r"[«\"']?([^»\"'\n,.;:!?]{1,80})",
)
_WORK_IN_FOLDER_RE = re.compile(
    r"(?is)(?:работай|пиши|сохрани|положи|создай\s+файл).{0,40}"
    r"(?:в|во)\s+(?:этой\s+|уже\s+созданн\w*\s+)?папк",
)


@dataclass(frozen=True, slots=True)
class CompanionFolderTarget:
    """Resolved write folder policy for a companion create turn."""

    mode: FolderWriteMode
    task_key: str | None = None
    folder_label: str | None = None
    folder_item_id: str | None = None
    reuse_query: str | None = None


def named_task_key_from_label(label: str) -> str:
    """Stable ASCII ``task_key`` for a human folder name (idempotent reuse)."""

    cleaned = sanitize_ewa_task_folder_label(label, fallback="Folder")
    digest = hashlib.sha1(cleaned.casefold().encode("utf-8")).hexdigest()[:16]
    return f"named-{digest}"


def _truthy(raw: Any) -> bool:
    if isinstance(raw, bool):
        return raw
    s = str(raw or "").strip().casefold()
    return s in {"1", "true", "yes", "on", "create", "reuse"}


def _clean_name(raw: str | None) -> str | None:
    s2 = str(raw or "").strip().strip(" «»\"'.,:;!?")
    if not s2:
        return None
    return sanitize_ewa_task_folder_label(s2, fallback="Folder")[:80]


def parse_companion_folder_intent(
    user_line: str,
    args: Mapping[str, Any] | None = None,
) -> CompanionFolderTarget:
    """Parse explicit folder create/reuse; default is EwaFile root.

    Never treats ``_agentic_session_id`` or companion run id as an implicit folder key.
    """

    a = args or {}
    line = (user_line or "").strip()

    explicit_item = str(a.get("folder_item_id") or "").strip()
    if explicit_item:
        return CompanionFolderTarget(mode="reuse", folder_item_id=explicit_item)

    explicit_key = str(a.get("task_key") or "").strip()
    # Agentic injects session id under a private key — never promote it to task_key here.
    if explicit_key and not explicit_key.startswith("_"):
        label = _clean_name(str(a.get("folder_label") or a.get("folder_name") or ""))
        return CompanionFolderTarget(
            mode="create" if _truthy(a.get("create_folder")) else "reuse",
            task_key=explicit_key[:80],
            folder_label=label,
        )

    folder_name_arg = _clean_name(str(a.get("folder_name") or a.get("reuse_folder") or ""))
    if _truthy(a.get("create_folder")) or _truthy(a.get("new_folder")):
        label = folder_name_arg or _clean_name(str(a.get("folder_label") or "")) or "Folder"
        return CompanionFolderTarget(
            mode="create",
            task_key=named_task_key_from_label(label),
            folder_label=label,
        )

    reuse_arg = folder_name_arg or _clean_name(str(a.get("folder_label") or ""))
    if _truthy(a.get("reuse_folder")) or (
        reuse_arg
        and str(a.get("folder_label") or "").strip()
        and not _truthy(a.get("create_folder"))
        and ("folder_name" in a or "reuse_folder" in a)
    ):
        q = reuse_arg or "Folder"
        if is_ewa_task_folder_item_id(q):
            return CompanionFolderTarget(mode="reuse", folder_item_id=q, reuse_query=q)
        return CompanionFolderTarget(mode="reuse", reuse_query=q, folder_label=q)

    # Natural language — create before reuse so «создай папку X и файл» wins.
    for rx in (_CREATE_FOLDER_RE, _CREATE_FOLDER_EN_RE, _IN_NEW_FOLDER_RE):
        m = rx.search(line)
        if m:
            label = _clean_name(m.group(1) if m.lastindex else None) or "Folder"
            return CompanionFolderTarget(
                mode="create",
                task_key=named_task_key_from_label(label),
                folder_label=label,
            )

    for rx in (_REUSE_QUOTED_RE, _REUSE_EN_RE, _REUSE_BARE_RE):
        m = rx.search(line)
        if m:
            q = _clean_name(m.group(1)) or ""
            if not q:
                continue
            # Avoid treating «в папке EwaFile» as nested task folder.
            if q.casefold() in {"ewafile", "ewa_file", "ewa file"}:
                return CompanionFolderTarget(mode="root")
            if is_ewa_task_folder_item_id(q):
                return CompanionFolderTarget(mode="reuse", folder_item_id=q, reuse_query=q)
            return CompanionFolderTarget(mode="reuse", reuse_query=q, folder_label=q)

    if _WORK_IN_FOLDER_RE.search(line) and folder_name_arg:
        return CompanionFolderTarget(
            mode="reuse",
            reuse_query=folder_name_arg,
            folder_label=folder_name_arg,
        )

    return CompanionFolderTarget(mode="root")


async def resolve_companion_folder_target(
    *,
    user_line: str,
    args: Mapping[str, Any] | None,
    content_user_id: str,
) -> CompanionFolderTarget:
    """Resolve NL/tool_args intent to concrete task_key / folder_item_id (DB lookup for reuse)."""

    parsed = parse_companion_folder_intent(user_line, args)
    if parsed.mode == "root":
        return parsed
    if parsed.folder_item_id:
        return parsed
    if parsed.mode == "create" and parsed.task_key:
        return parsed

    query = (parsed.reuse_query or parsed.folder_label or "").strip()
    uid = (content_user_id or "").strip()
    if parsed.mode == "reuse" and query and uid:
        from api.services.ewa_task_folder_service import find_ewa_task_folder_by_label_for_user

        found = await find_ewa_task_folder_by_label_for_user(user_id=uid, query=query)
        if found:
            logger.info(
                "[STEP] companion_folder_reuse_hit query=%s item_id=%s",
                query[:48],
                found[:48],
            )
            return CompanionFolderTarget(
                mode="reuse",
                folder_item_id=found,
                folder_label=parsed.folder_label or query,
                reuse_query=query,
            )
        # Missing folder: create idempotent named folder so «в папке X» still lands in X.
        label = sanitize_ewa_task_folder_label(query, fallback="Folder")
        key = named_task_key_from_label(label)
        logger.info(
            "[STEP] companion_folder_reuse_miss_create query=%s task_key=%s",
            query[:48],
            key,
        )
        return CompanionFolderTarget(mode="create", task_key=key, folder_label=label)

    if parsed.task_key:
        return parsed
    return CompanionFolderTarget(mode="root")


__all__ = (
    "CompanionFolderTarget",
    "FolderWriteMode",
    "named_task_key_from_label",
    "parse_companion_folder_intent",
    "resolve_companion_folder_target",
)
