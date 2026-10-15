"""Сборка JSON для Llama POST /api/embed (официальный API, не /api/embeddings)."""

from __future__ import annotations

from typing import Any

from api.core.unified_config import unified_settings
from api.utils.llama_keep_alive import llama_keep_alive_from_settings


def llama_embed_dimensions() -> int:
    """Размерность вектора из AI_EMBEDDINGS_DIMENSION (Chroma/Qdrant должны совпадать)."""
    return int(getattr(unified_settings, "ai_embeddings_dimension", 768) or 768)


def build_llama_embed_payload(
    *,
    model: str,
    input_data: str | list[str],
    keep_alive: str | int | None = None,
) -> dict[str, Any]:
    """
    Поля см. https://docs.llama.com/api/embed — model, input, keep_alive, dimensions (опционально).
    dimensions указывает желаемую длину вектора (MRL / усечение для qwen3-embedding и др.).
    """
    ka = keep_alive if keep_alive is not None else llama_keep_alive_from_settings()
    payload: dict[str, Any] = {"model": model, "input": input_data, "keep_alive": ka}
    dim = llama_embed_dimensions()
    if dim >= 32:
        payload["dimensions"] = dim
    return payload
