"""GAF Chat internal constants (system user id for service messages)."""

from __future__ import annotations

import os
from uuid import UUID

# unified_content.sub_type — не показывать в библиотеке файлового менеджера (только чат / API вложения)
CONTENT_SUBTYPE_GAF_CHAT_VOICE = "gaf_chat_voice"

# Префикс имён файлов голосовых из фронта (см. shared/web/.../gafVoiceConstants.ts)
_GAF_VOICE_NAME_PREFIX = "gaf-voice-"


def is_gaf_voice_upload_filename(name: str | None) -> bool:
    """Имя файла голосового вложения GAF (webm и т.д.)."""
    n = (name or "").strip().lower()
    return bool(n) and n.startswith(_GAF_VOICE_NAME_PREFIX)


# Must match seed in migrations/pending/20260410_users_trusted_system_gaf.sql
DEFAULT_GAF_SYSTEM_USER_ID = UUID("00000000-0000-4000-8000-000000000001")


def get_gaf_system_user_id() -> UUID:
    """Env ELITE_GAF_SYSTEM_USER_ID overrides default (must exist in users with is_system_account)."""
    raw = (os.environ.get("ELITE_GAF_SYSTEM_USER_ID") or "").strip()
    if raw:
        return UUID(raw)
    return DEFAULT_GAF_SYSTEM_USER_ID


def is_gaf_system_user_id(user_id: str | None) -> bool:
    if not user_id:
        return False
    try:
        return UUID(str(user_id).strip()) == get_gaf_system_user_id()
    except ValueError:
        return False
