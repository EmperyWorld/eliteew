"""Слияние пресета с задачами master plan (фаза A): только дополнительные execute-задачи."""

from __future__ import annotations

import logging
from typing import Any
from uuid import uuid4

from api.schemas.marketing_cabinet.amka_preset import AmkaPresetConfigV1

logger = logging.getLogger(__name__)


def validate_amka_preset_config_v1(config: AmkaPresetConfigV1) -> None:
    """Проверка пресета при сохранении и перед планированием."""
    from api.services.marketing_cabinet.amka_analysis_registry import AMKA_PLAN_EXECUTION_MODES
    from api.services.marketing_cabinet.amka_service import AMKA_ACTIONABLE_SECTIONS

    for i, spec in enumerate(config.extra_plan_tasks):
        t = spec.task
        sk = str(t.get("section_key") or "").strip()
        if not sk or sk not in AMKA_ACTIONABLE_SECTIONS:
            msg = f"preset.extra_plan_tasks[{i}]: недопустимый section_key {sk!r}"
            raise ValueError(msg)
        em = str(t.get("execution_mode") or "").strip()
        if not em or em not in AMKA_PLAN_EXECUTION_MODES:
            msg = f"preset.extra_plan_tasks[{i}]: недопустимый execution_mode {em!r}"
            raise ValueError(msg)
        title = str(t.get("title") or "").strip()
        if not title:
            msg = f"preset.extra_plan_tasks[{i}]: нужен непустой title"
            raise ValueError(msg)
        if em == "imc_research" and sk != "imc":
            msg = f"preset.extra_plan_tasks[{i}]: imc_research только для section_key=imc"
            raise ValueError(msg)


def merge_preset_tasks_into_plan_tasks(
    base_tasks: list[dict[str, Any]],
    preset: AmkaPresetConfigV1,
) -> list[dict[str, Any]]:
    """Вставляет задачи пресета в копию списка задач плана без повторной топосортировки."""
    from api.services.marketing_cabinet.amka_service import _sanitize_amka_imc_plan_tasks

    validate_amka_preset_config_v1(preset)
    out: list[dict[str, Any]] = [dict(t) for t in base_tasks]
    for spec in preset.extra_plan_tasks:
        task = dict(spec.task)
        sk = str(task.get("section_key") or "").strip()
        if not task.get("step_key"):
            task["step_key"] = f"preset_{sk}_{uuid4().hex[:10]}"
        insert_after = (spec.insert_after_section_key or "").strip() or None
        insert_at: int | None = None
        if insert_after:
            for j in range(len(out) - 1, -1, -1):
                if str(out[j].get("section_key") or "").strip() == insert_after:
                    insert_at = j
                    break
        if insert_at is None:
            out.append(task)
            logger.info(
                "[AMKA] preset task appended (after=%s) section=%s",
                insert_after or "—",
                sk,
            )
        else:
            out.insert(insert_at + 1, task)
            logger.info(
                "[AMKA] preset task inserted after index=%s section=%s",
                insert_at,
                sk,
            )
    return _sanitize_amka_imc_plan_tasks(out)


def parse_preset_config_from_db(raw: Any) -> AmkaPresetConfigV1:  # noqa: ANN401
    if raw is None:
        return AmkaPresetConfigV1()
    if isinstance(raw, dict):
        try:
            return AmkaPresetConfigV1.model_validate(raw)
        except Exception:
            return AmkaPresetConfigV1()
    return AmkaPresetConfigV1()
