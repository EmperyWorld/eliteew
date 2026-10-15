# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Stable HTTP detail strings for Unified Content storage failures.
# Invariants:
# - Raw storage backend exception messages are never copied into client-facing details.
# - 500 responses carry an opaque reference id, while server logs keep the actual exception.
# Related:
# - api/routers/unified_content.py
# ---
"""Safe client-facing details for Unified Content storage errors."""

STORAGE_OBJECT_UNAVAILABLE_DETAIL = (
    "Файл в хранилище недоступен: объект отсутствует или не читается. "
    "Если файл был помечен как повреждённый, откройте вкладку «Битые файлы» в файловом менеджере — "
    "там можно проверить снова или удалить запись окончательно."
)
STORAGE_TEMPORARILY_UNAVAILABLE_DETAIL = "Хранилище временно недоступно. Повторите попытку через несколько секунд."
INTERNAL_SERVER_ERROR_DETAIL_PREFIX = "Internal server error. Reference: "


def storage_object_unavailable_detail(_error: Exception | None = None) -> str:
    """Return a stable missing/corrupted-object detail without leaking backend messages."""
    return STORAGE_OBJECT_UNAVAILABLE_DETAIL


def storage_temporarily_unavailable_detail(_error: Exception | None = None) -> str:
    """Return a stable transient-storage detail without leaking backend messages."""
    return STORAGE_TEMPORARILY_UNAVAILABLE_DETAIL


def internal_server_error_detail(error_id: str) -> str:
    """Return a stable internal-error detail with an opaque support reference."""
    return f"{INTERNAL_SERVER_ERROR_DETAIL_PREFIX}{error_id}"
