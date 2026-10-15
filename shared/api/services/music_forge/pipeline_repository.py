# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# SQL persistence и step machine для MusicForge runs: loaders, lifecycle шагов,
# progress, UGS linkage, cancellation guards.
# Invariants:
# - Terminal run statuses are not overwritten by late workers (_set_run_status guard).
# - Step rows are created from Mode pipeline (+ result_ready); STEP_DEFS is legacy fallback.
# Related:
# - api/services/music_forge/pipeline.py
# - api/services/music_forge/stale.py
# ---
"""MusicForge pipeline SQL repository and step machine."""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from api.schemas.music_forge import MusicForgeRunOut, MusicForgeStepOut
from api.services.music_forge.algorithm import MUSIC_FORGE_AUDIO_TYPE_KEY
from api.services.music_forge.pipeline_steps_materialize import (
    MUSIC_FORGE_TOTAL_STEPS,
    STEP_DEFS,
    legacy_step_defs_without_result_ready,
    materialize_run_steps,
)
from api.services.music_forge.stale import MUSIC_FORGE_STALE_ERROR
from api.services.ugs.unified_generation_service import UnifiedGenerationService

logger = logging.getLogger(__name__)

MUSIC_FORGE_TERMINAL_STATUSES = frozenset({"completed", "failed", "cancelled"})

# Re-export for import-chain / legacy callers.
__all__ = (
    "MUSIC_FORGE_TERMINAL_STATUSES",
    "MUSIC_FORGE_TOTAL_STEPS",
    "STEP_DEFS",
    "MusicForgeCancelled",
    "MusicForgeRunRepository",
    "run_out_from_rows",
)


class MusicForgeCancelled(RuntimeError):
    """Raised when the durable run was cancelled while the worker was active."""


def _json_param(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _uuid(value: Any) -> UUID | None:
    if value is None:
        return None
    try:
        return value if isinstance(value, UUID) else UUID(str(value))
    except TypeError, ValueError:
        return None


def _dt(value: Any) -> datetime | None:
    return value if isinstance(value, datetime) else None


def run_out_from_rows(row: dict[str, Any], step_rows: list[dict[str, Any]]) -> MusicForgeRunOut:
    """Map SQL rows to API response schema."""
    return MusicForgeRunOut(
        id=UUID(str(row["id"])),
        status=str(row["status"]),
        idea=str(row["idea"]),
        language=str(row.get("language") or "ru"),
        style_hint=row.get("style_hint"),
        constraints=row.get("constraints"),
        duration_seconds=int(row.get("duration_seconds") or 220),
        progress_current=int(row.get("progress_current") or 0),
        progress_total=int(row.get("progress_total") or MUSIC_FORGE_TOTAL_STEPS),
        normalized_input=dict(row.get("normalized_input") or {}),
        song_blueprint=dict(row.get("song_blueprint") or {}),
        lyrics_payload=dict(row.get("lyrics_payload") or {}),
        style_capsule=dict(row.get("style_capsule") or {}),
        render_payload=dict(row.get("render_payload") or {}),
        result_payload=dict(row.get("result_payload") or {}),
        error_payload=dict(row.get("error_payload") or {}),
        content_id=_uuid(row.get("content_id")),
        ugs_request_id=_uuid(row.get("ugs_request_id")),
        config_revision_id=_uuid(row.get("config_revision_id")),
        config_version=str(row["config_version"]) if row.get("config_version") is not None else None,
        config_generation=(int(row["config_generation"]) if row.get("config_generation") is not None else None),
        started_at=_dt(row.get("started_at")),
        completed_at=_dt(row.get("completed_at")),
        cancelled_at=_dt(row.get("cancelled_at")),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        steps=[
            MusicForgeStepOut(
                id=_uuid(step.get("id")),
                step_index=int(step["step_index"]),
                step_kind=str(step["step_kind"]),
                title=str(step["title"]),
                status=str(step["status"]),
                input_payload=dict(step.get("input_payload") or {}),
                output_payload=dict(step.get("output_payload") or {}),
                error_payload=dict(step.get("error_payload") or {}),
                started_at=_dt(step.get("started_at")),
                completed_at=_dt(step.get("completed_at")),
                duration_ms=step.get("duration_ms"),
            )
            for step in step_rows
        ],
    )


class MusicForgeRunRepository:
    """SQL/step persistence for MusicForge pipeline runs."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def _load_run_row(self, *, run_id: str, user_id: str) -> Any:
        return (
            (
                await self.db.execute(
                    text(
                        """
                        SELECT *
                        FROM music_forge_runs
                        WHERE id = CAST(:run_id AS uuid)
                          AND user_id = CAST(:user_id AS uuid)
                        """
                    ),
                    {"run_id": run_id, "user_id": user_id},
                )
            )
            .mappings()
            .first()
        )

    async def _load_run_row_by_id(self, *, run_id: str) -> Any:
        return (
            (
                await self.db.execute(
                    text("SELECT * FROM music_forge_runs WHERE id = CAST(:run_id AS uuid)"),
                    {"run_id": run_id},
                )
            )
            .mappings()
            .first()
        )

    async def _count_completed_runs_for_user(self, *, user_id: str, window_hours: int | None = None) -> int:
        clauses = ["user_id = CAST(:user_id AS uuid)", "status = 'completed'"]
        params: dict[str, Any] = {"user_id": user_id}
        if window_hours is not None:
            clauses.append("completed_at >= NOW() - make_interval(hours => :window_hours)")
            params["window_hours"] = int(window_hours)
        result = await self.db.execute(
            text(f"SELECT COUNT(*) AS count FROM music_forge_runs WHERE {' AND '.join(clauses)}"),
            params,
        )
        return int(result.scalar_one())

    async def _load_step_rows(self, *, run_id: str) -> Any:
        return (
            (
                await self.db.execute(
                    text(
                        """
                        SELECT *
                        FROM music_forge_run_steps
                        WHERE run_id = CAST(:run_id AS uuid)
                        ORDER BY step_index ASC
                        """
                    ),
                    {"run_id": run_id},
                )
            )
            .mappings()
            .all()
        )

    async def _fail_stale_run(self, *, run_id: str) -> bool:
        """Mark orphan non-terminal runs failed so clients stop polling."""
        changed = await self._set_run_status(
            run_id,
            "failed",
            error_payload=dict(MUSIC_FORGE_STALE_ERROR),
        )
        if changed:
            await self.db.execute(
                text(
                    """
                    UPDATE music_forge_run_steps
                    SET status = 'failed',
                        error_payload = CAST(:error_payload AS jsonb),
                        completed_at = COALESCE(completed_at, NOW()),
                        updated_at = NOW()
                    WHERE run_id = CAST(:run_id AS uuid)
                      AND status NOT IN ('completed', 'failed', 'cancelled', 'skipped')
                    """
                ),
                {"run_id": run_id, "error_payload": _json_param(dict(MUSIC_FORGE_STALE_ERROR))},
            )
            await self.db.commit()
            logger.warning("MusicForge stale run failed run_id=%s", run_id)
        return changed

    async def _ensure_steps(self, run_id: UUID) -> None:
        """Legacy fixed STEP_DEFS (fallback when Mode pipeline unavailable)."""
        await self._ensure_steps_for_pipeline(str(run_id), legacy_step_defs_without_result_ready())

    async def _ensure_steps_for_pipeline(self, run_id: str | UUID, stages: list[dict[str, Any]]) -> None:
        """Materialize durable steps from Mode pipeline stages + trailing result_ready."""
        await materialize_run_steps(self.db, run_id, stages)

    async def _claim_run_for_execution(self, *, run_id: str) -> bool:
        result = await self.db.execute(
            text(
                """
                UPDATE music_forge_runs
                SET status = 'running',
                    started_at = COALESCE(started_at, NOW()),
                    updated_at = NOW()
                WHERE id = CAST(:run_id AS uuid)
                  AND status = 'queued'
                RETURNING status
                """
            ),
            {"run_id": run_id},
        )
        row = result.mappings().first()
        await self.db.commit()
        return row is not None

    async def _set_run_status(self, run_id: str, status: str, *, error_payload: dict[str, Any] | None = None) -> bool:
        common_set = """
            completed_at = CASE WHEN :status IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE completed_at END,
            updated_at = NOW()
        """
        if error_payload is not None:
            result = await self.db.execute(
                text(
                    f"""
                    UPDATE music_forge_runs
                    SET status = :status,
                        error_payload = CAST(:error_payload AS jsonb),
                        {common_set}
                    WHERE id = CAST(:run_id AS uuid)
                      AND status NOT IN ('completed', 'failed', 'cancelled')
                    RETURNING status
                    """
                ),
                {"run_id": run_id, "status": status, "error_payload": _json_param(error_payload)},
            )
        else:
            result = await self.db.execute(
                text(
                    f"""
                    UPDATE music_forge_runs
                    SET status = :status,
                        {common_set}
                    WHERE id = CAST(:run_id AS uuid)
                      AND status NOT IN ('completed', 'failed', 'cancelled')
                    RETURNING status
                    """
                ),
                {"run_id": run_id, "status": status},
            )
        await self.db.commit()
        return result.mappings().first() is not None

    async def _start_step(self, run_id: str, step_kind: str, input_payload: dict[str, Any] | None = None) -> None:
        await self.db.execute(
            text(
                """
                UPDATE music_forge_run_steps
                SET status = 'running',
                    input_payload = CAST(:input_payload AS jsonb),
                    started_at = COALESCE(started_at, NOW()),
                    updated_at = NOW()
                WHERE run_id = CAST(:run_id AS uuid)
                  AND step_kind = :step_kind
                  AND status NOT IN ('completed', 'failed', 'cancelled', 'skipped')
                """
            ),
            {"run_id": run_id, "step_kind": step_kind, "input_payload": _json_param(input_payload or {})},
        )
        await self.db.commit()

    async def _complete_step(self, run_id: str, step_kind: str, output_payload: dict[str, Any] | None = None) -> None:
        await self.db.execute(
            text(
                """
                UPDATE music_forge_run_steps
                SET status = 'completed',
                    output_payload = CAST(:output_payload AS jsonb),
                    completed_at = NOW(),
                    duration_ms = CASE
                        WHEN started_at IS NULL THEN NULL
                        ELSE GREATEST(0, CAST(EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000 AS integer))
                    END,
                    updated_at = NOW()
                WHERE run_id = CAST(:run_id AS uuid)
                  AND step_kind = :step_kind
                  AND status NOT IN ('failed', 'cancelled', 'skipped')
                """
            ),
            {"run_id": run_id, "step_kind": step_kind, "output_payload": _json_param(output_payload or {})},
        )
        await self._refresh_progress(run_id)
        await self.db.commit()

    async def _skip_step(self, run_id: str, step_kind: str, output_payload: dict[str, Any] | None = None) -> None:
        await self.db.execute(
            text(
                """
                UPDATE music_forge_run_steps
                SET status = 'skipped',
                    output_payload = CAST(:output_payload AS jsonb),
                    completed_at = COALESCE(completed_at, NOW()),
                    updated_at = NOW()
                WHERE run_id = CAST(:run_id AS uuid)
                  AND step_kind = :step_kind
                  AND status NOT IN ('completed', 'failed', 'cancelled', 'skipped')
                """
            ),
            {"run_id": run_id, "step_kind": step_kind, "output_payload": _json_param(output_payload or {})},
        )
        await self._refresh_progress(run_id)
        await self.db.commit()

    async def _fail_step(self, run_id: str, step_kind: str, error_payload: dict[str, Any]) -> None:
        await self.db.execute(
            text(
                """
                UPDATE music_forge_run_steps
                SET status = 'failed',
                    error_payload = CAST(:error_payload AS jsonb),
                    completed_at = COALESCE(completed_at, NOW()),
                    updated_at = NOW()
                WHERE run_id = CAST(:run_id AS uuid)
                  AND step_kind = :step_kind
                  AND status NOT IN ('completed', 'cancelled', 'skipped')
                """
            ),
            {"run_id": run_id, "step_kind": step_kind, "error_payload": _json_param(error_payload)},
        )
        await self.db.commit()

    async def _cancel_incomplete_steps(self, *, run_id: str, reason: str) -> None:
        await self.db.execute(
            text(
                """
                UPDATE music_forge_run_steps
                SET status = 'cancelled',
                    error_payload = CAST(:error_payload AS jsonb),
                    completed_at = COALESCE(completed_at, NOW()),
                    updated_at = NOW()
                WHERE run_id = CAST(:run_id AS uuid)
                  AND status NOT IN ('completed', 'failed', 'cancelled', 'skipped')
                """
            ),
            {"run_id": run_id, "error_payload": _json_param({"message": reason})},
        )

    async def _refresh_progress(self, run_id: str) -> None:
        # progress_total = durable step count (Mode stages + result_ready), not the
        # legacy MUSIC_FORGE_TOTAL_STEPS=8 constant (seed pipelines are often 9).
        await self.db.execute(
            text(
                """
                UPDATE music_forge_runs
                SET progress_current = (
                        SELECT COUNT(*)
                        FROM music_forge_run_steps
                        WHERE run_id = CAST(:run_id AS uuid)
                          AND status IN ('completed', 'skipped')
                    ),
                    progress_total = GREATEST(
                        (
                            SELECT COUNT(*)
                            FROM music_forge_run_steps
                            WHERE run_id = CAST(:run_id AS uuid)
                        ),
                        1
                    ),
                    updated_at = NOW()
                WHERE id = CAST(:run_id AS uuid)
                """
            ),
            {"run_id": run_id},
        )

    async def _persist_json(self, run_id: str, column: str, value: dict[str, Any]) -> None:
        if column not in {
            "normalized_input",
            "song_blueprint",
            "lyrics_payload",
            "style_capsule",
            "render_payload",
        }:
            raise ValueError(f"unsupported music_forge json column: {column}")
        await self.db.execute(
            text(
                f"""
                UPDATE music_forge_runs
                SET {column} = CAST(:value AS jsonb),
                    updated_at = NOW()
                WHERE id = CAST(:run_id AS uuid)
                """
            ),
            {"run_id": run_id, "value": _json_param(value)},
        )
        await self.db.commit()

    async def _raise_if_cancelled(self, *, run_id: str) -> None:
        result = await self.db.execute(
            text("SELECT status FROM music_forge_runs WHERE id = CAST(:run_id AS uuid)"),
            {"run_id": run_id},
        )
        row = result.mappings().first()
        status = str(row.get("status") or "").strip().lower() if row is not None else ""
        if status == "cancelled":
            raise MusicForgeCancelled(f"music_forge_cancelled:{run_id}")
        if status in {"completed", "failed"}:
            raise MusicForgeCancelled(f"music_forge_terminal:{status}:{run_id}")

    async def _find_latest_ugs_request_id_for_run(self, *, run_id: str, active_only: bool = False) -> UUID | None:
        clauses = [
            "gr.deleted_at IS NULL",
            "(gr.input_data->>'music_forge_run_id' = :run_id OR gr.request_metadata->>'music_forge_run_id' = :run_id)",
        ]
        if active_only:
            clauses.append("gr.status NOT IN ('completed', 'failed', 'cancelled')")
        result = await self.db.execute(
            text(
                f"""
                SELECT gr.id
                FROM generation_requests gr
                JOIN generation_types gt ON gt.id = gr.type_id
                WHERE {" AND ".join(clauses)}
                  AND gt.type_key = :type_key
                ORDER BY gr.created_at DESC
                LIMIT 1
                """
            ),
            {"run_id": run_id, "type_key": MUSIC_FORGE_AUDIO_TYPE_KEY},
        )
        row = result.mappings().first()
        return _uuid(row.get("id")) if row is not None else None

    async def _persist_ugs_request_id(self, *, run_id: str, ugs_request_id: str | UUID | None) -> None:
        parsed = _uuid(ugs_request_id)
        if parsed is None:
            return
        await self.db.execute(
            text(
                """
                UPDATE music_forge_runs
                SET ugs_request_id = CAST(:ugs_request_id AS uuid),
                    updated_at = NOW()
                WHERE id = CAST(:run_id AS uuid)
                  AND ugs_request_id IS DISTINCT FROM CAST(:ugs_request_id AS uuid)
                """
            ),
            {"run_id": run_id, "ugs_request_id": str(parsed)},
        )
        await self.db.commit()

    async def _cancel_ugs_request(
        self,
        *,
        ugs: UnifiedGenerationService,
        ugs_request_id: str,
        user_id: str,
    ) -> None:
        try:
            await ugs.cancel_generation(ugs_request_id, user_id=user_id)
        except (ValueError, PermissionError) as exc:
            logger.info("MusicForge UGS cancel skipped user_id=%s request_id=%s err=%s", user_id, ugs_request_id, exc)
        except Exception:
            logger.exception("MusicForge UGS cancel failed request_id=%s", ugs_request_id)


MusicForgePipelineRepositoryMixin = MusicForgeRunRepository
