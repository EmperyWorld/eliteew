"""Загрузка и merge операторского конфига AMKA (БД + env)."""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import asyncpg

from api.core.unified_config import unified_settings
from api.schemas.marketing_cabinet.amka_operator_config import (
    AmkaOperatorConfigEffectiveOut,
    AmkaOperatorConfigEnvCapsOut,
    AmkaOperatorConfigV1,
)
from api.services.marketing_cabinet.amka_final_prompt_compact import AMKA_FINAL_PROMPT_MAX_CHARS

logger = logging.getLogger(__name__)

_DEFAULT_ROW_ID = "default"


def _clamp_int(value: int, lo: int, hi: int) -> int:
    return max(lo, min(hi, value))


def _clamp_float(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def parse_operator_config_from_json(raw: Any) -> AmkaOperatorConfigV1:
    if raw is None:
        return AmkaOperatorConfigV1()
    if isinstance(raw, str):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            return AmkaOperatorConfigV1()
    elif isinstance(raw, dict):
        data = raw
    else:
        return AmkaOperatorConfigV1()
    try:
        return AmkaOperatorConfigV1.model_validate(data)
    except Exception:
        logger.warning("[AMKA] operator_config invalid JSON, using defaults", exc_info=True)
        return AmkaOperatorConfigV1()


def env_caps() -> AmkaOperatorConfigEnvCapsOut:
    env_delay = int(unified_settings.amka_audit_llm_delay_ms)
    env_par = int(unified_settings.amka_audit_llm_parallelism)
    env_wait = float(unified_settings.amka_project_generate_step_max_wait_seconds)

    return AmkaOperatorConfigEnvCapsOut(
        audit_delay_ms_max=max(0, env_delay),
        audit_parallelism_max=max(1, env_par),
        execute_max_wait_seconds_max=max(30.0, env_wait),
        execute_max_wait_seconds_min=30.0,
        final_prompt_chars_max=int(AMKA_FINAL_PROMPT_MAX_CHARS),
        master_plan_max_tokens_max=8000,
    )


def merge_effective_operator_config(stored: AmkaOperatorConfigV1) -> AmkaOperatorConfigEffectiveOut:
    caps = env_caps()
    env_delay = caps.audit_delay_ms_max
    env_par = caps.audit_parallelism_max
    env_wait = caps.execute_max_wait_seconds_max

    sec = stored.section_llm_audit
    delay_eff = env_delay if sec.delay_ms is None else _clamp_int(sec.delay_ms, 0, env_delay)
    par_eff = env_par if sec.parallelism is None else _clamp_int(sec.parallelism, 1, env_par)

    mp = stored.master_plan
    mt_eff = 4096 if mp.max_tokens is None else _clamp_int(mp.max_tokens, 512, caps.master_plan_max_tokens_max)
    retry_parse_eff = bool(unified_settings.amka_master_plan_retry_on_parse) or bool(mp.retry_on_parse_failure)
    repair_json_eff = bool(unified_settings.amka_master_plan_repair_json) or bool(mp.repair_json_on_parse_failure)

    ex = stored.execute
    wait_eff = env_wait if ex.max_wait_seconds is None else _clamp_float(float(ex.max_wait_seconds), 30.0, env_wait)

    fin = stored.final_assessment
    chars_cap = caps.final_prompt_chars_max
    chars_eff = chars_cap if fin.max_prompt_chars is None else _clamp_int(fin.max_prompt_chars, 10_000, chars_cap)

    return AmkaOperatorConfigEffectiveOut(
        baseline_audit={
            "extra_prompt_suffix": stored.baseline_audit.extra_prompt_suffix,
        },
        section_llm_audit={
            "enabled": sec.enabled,
            "delay_ms": delay_eff,
            "parallelism": par_eff,
            "require_work_needed_quotes": sec.require_work_needed_quotes,
            "extra_prompt_instruction": sec.extra_prompt_instruction,
        },
        master_plan={
            "llm_enabled": mp.llm_enabled,
            "max_tokens": mt_eff,
            "extra_prompt_instruction": mp.extra_prompt_instruction,
            "retry_on_parse_failure": retry_parse_eff,
            "repair_json_on_parse_failure": repair_json_eff,
        },
        execute={
            "max_wait_seconds": wait_eff,
            "exclude_recent_imc_type_keys": bool(ex.exclude_recent_imc_type_keys),
            "exclude_recent_imc_type_keys_limit": _clamp_int(ex.exclude_recent_imc_type_keys_limit, 0, 20),
            "desktop_ensemble_enabled": bool(ex.desktop_ensemble_enabled),
            "ensemble_fallback_to_tool_agent": bool(ex.ensemble_fallback_to_tool_agent),
        },
        final_assessment={
            "llm_enabled": fin.llm_enabled,
            "max_prompt_chars": chars_eff,
            "extra_prompt_instruction": fin.extra_prompt_instruction,
        },
    )


def _iso_utc(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC).isoformat()
    return dt.isoformat()


async def fetch_operator_config_row(
    pool: asyncpg.Pool,
) -> tuple[AmkaOperatorConfigV1, datetime | None, UUID | None]:
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT config, updated_at, updated_by_user_id
            FROM marketing_amka_operator_config
            WHERE id = $1
            """,
            _DEFAULT_ROW_ID,
        )
    if not row:
        return AmkaOperatorConfigV1(), None, None
    stored = parse_operator_config_from_json(row["config"])
    return stored, row["updated_at"], row["updated_by_user_id"]


async def fetch_stored_operator_config(pool: asyncpg.Pool) -> AmkaOperatorConfigV1:
    stored, _, _ = await fetch_operator_config_row(pool)
    return stored


async def load_operator_config_bundle(
    pool: asyncpg.Pool,
) -> tuple[AmkaOperatorConfigV1, AmkaOperatorConfigEffectiveOut, AmkaOperatorConfigEnvCapsOut, str | None, str | None]:
    stored, updated_at, updated_by = await fetch_operator_config_row(pool)
    caps = env_caps()
    effective = merge_effective_operator_config(stored)
    updated_by_s = str(updated_by) if updated_by is not None else None
    return stored, effective, caps, _iso_utc(updated_at), updated_by_s


async def upsert_operator_config(
    pool: asyncpg.Pool,
    *,
    config: AmkaOperatorConfigV1,
    updated_by_user_id: UUID | None,
) -> None:
    payload = config.model_dump(mode="json")
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO marketing_amka_operator_config (id, config, updated_at, updated_by_user_id)
            VALUES ($1, $2::jsonb, NOW(), $3)
            ON CONFLICT (id) DO UPDATE SET
                config = EXCLUDED.config,
                updated_at = NOW(),
                updated_by_user_id = EXCLUDED.updated_by_user_id
            """,
            _DEFAULT_ROW_ID,
            json.dumps(payload),
            updated_by_user_id,
        )
