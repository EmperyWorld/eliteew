# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# ИМК RAG orchestration helpers: num_predict, concat/stitch drafts, empty-RAG markdown, progress emit.
# Invariants:
# - Merge без новых фактов; stitch — только fallback при отказе merge.
# Related:
# - api.services.ugs.providers.imc_rag_orchestrate_pipeline
# - api.services.ugs.providers.imc_rag_orchestration
# ---

"""Shared helpers for IMC RAG multi-section orchestration."""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any

from api.core.unified_config import unified_settings

logger = logging.getLogger(__name__)

_NUM_PREDICT_CAP = 131_072
_NUM_PREDICT_FLOOR = 512
_ORCHESTRATE_STEP_NUM_PREDICT_DEFAULT = 8192
_ORCHESTRATE_MERGE_NUM_PREDICT_DEFAULT = 12_288

EMPTY_RAG_MARKDOWN = (
    "## Недостаточно контекста\n\n"
    "В переданных фрагментах документов проекта нет материала для опоры выводов. "
    "Загрузите релевантные файлы в хранилище проекта и повторите запуск.\n\n"
    "_Ответ сформирован без вызова языковой модели из-за пустого контекста._"
)


def _clamp_num_predict(n: int) -> int:
    return max(_NUM_PREDICT_FLOOR, min(_NUM_PREDICT_CAP, n))


def _resolve_num_predict(input_data: dict[str, Any]) -> int:
    """
    Приоритет: явный imc_num_predict из UGS input_data (тип/миграция), иначе env + imc_answer_depth.
    depth: brief ~ половина базы, standard — база, deep — до 1.5× базы (в пределах cap).
    """
    raw = input_data.get("imc_num_predict")
    base = int(getattr(unified_settings, "imc_rag_num_predict", 24576) or 24576)
    base = _clamp_num_predict(base)
    if isinstance(raw, (int, float)) and int(raw) >= _NUM_PREDICT_FLOOR:
        return _clamp_num_predict(int(raw))
    depth = str(input_data.get("imc_answer_depth") or "").strip().lower()
    if depth == "brief":
        return _clamp_num_predict(max(_NUM_PREDICT_FLOOR, base // 2))
    if depth == "deep":
        return _clamp_num_predict(int(min(_NUM_PREDICT_CAP, max(base, round(base * 1.5)))))
    return base


def resolve_num_predict(input_data: dict[str, Any]) -> int:
    return _resolve_num_predict(input_data)


def concat_orchestrated_sections(drafts: list[tuple[str, str]]) -> str:
    """
    Склейка черновиков без вызова LLM: сохраняет полный объём разделов (анти-сжатие merge).
    Разделители --- визуально отделяют главы для читателя.
    """
    blocks: list[str] = []
    for title, body in drafts:
        t = str(title).strip()
        b = (body or "").strip()
        if not t and not b:
            continue
        blocks.append(f"## {t}\n\n{b}".rstrip())
    return "\n\n---\n\n".join(blocks).strip()


def stitch_orchestrated_fallback(drafts: list[tuple[str, str]], *, imc_type_key: str) -> str:
    """Если merge вернул отказ/мусор — отдаём связный markdown из черновиков разделов."""
    lines: list[str] = [
        "## Итог",
        "",
        "_Авто-сборка: финальный merge моделью не удалась (отказ или обрыв). Ниже — черновики разделов подряд._",
        "",
        f"_Тип: `{imc_type_key}`_",
        "",
    ]
    for title, body in drafts:
        lines.append(f"## {title}\n\n{body.strip()}\n\n")
    return "\n".join(lines).rstrip() + "\n"


async def emit_imc_progress(
    emit_progress_cb: Callable[[float, str], Awaitable[None]] | None,
    progress: float,
    message: str,
) -> None:
    if emit_progress_cb is None:
        return
    try:
        await emit_progress_cb(float(progress), str(message))
    except Exception as exc:
        logger.warning(
            "[STEP] imc.rag_research.progress_callback_failed err=%s",
            exc,
        )
