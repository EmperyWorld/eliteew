"""IMC RAG enrichment policy: metadata flags and merge vs vector-only mode (no heavy deps)."""

from __future__ import annotations

from typing import Any


def coerce_meta_bool(value: Any, *, default: bool = False) -> bool:
    """Coerce JSONB / admin UI metadata flags to bool (strings, ints)."""
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    if isinstance(value, str):
        s = value.strip().lower()
        if s in ("0", "false", "no", "off", ""):
            return False
        if s in ("1", "true", "yes", "on"):
            return True
        return default
    return default


def resolve_imc_use_merged_context(*, type_key: str, meta: dict[str, Any]) -> bool:
    """
    PG-карточка проекта + Qdrant (как в маркетинговом чате) vs только векторный поиск.

    Для типов imc_rag_* по умолчанию включено объединение: иначе при отсутствии ключа в type_metadata
    теряется слой Postgres и при пустом индексе контекст оказывается пустым.
    Явное imc_use_merged_context: false отключает merge.
    """
    raw = meta.get("imc_use_merged_context")
    if raw is None and str(type_key or "").startswith("imc_rag_"):
        return True
    return coerce_meta_bool(raw, default=False)
