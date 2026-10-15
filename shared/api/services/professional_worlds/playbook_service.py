# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Resolve Realtor (and future vertical) AI playbooks, run sequential UGS-backed steps, persist artifacts, and support admin playbook CRUD plus dry-run previews.
# Invariants:
# - Playbook runs are user-scoped; cross-user reads are rejected.
# - Idempotent launches reuse completed runs; resumes reuse successful step artifacts without duplicating rows.
# - Client disconnect checks cancel runs between steps (safe boundaries); mid-step UGS work continues until step completes.
# - Input guardrails derived from JSON-schema style required keys block UGS before spend when configured on actions.
# - Each step uses the configured AI action UGS type and billing path from `generation_types`.
# Related:
# - api/routers/professional_worlds.py
# - api/routers/professional_worlds_admin.py
# - api/services/professional_worlds/service.py
# - api/services/professional_worlds/ai_actions.py
# ---

from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator, Awaitable, Callable, Mapping
from typing import Any
from uuid import UUID

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.services.professional_worlds.admin_service import ProfessionalWorldsAdminService
from api.services.professional_worlds.ai_actions import ProfessionalWorldsAiActionService
from api.services.professional_worlds.service import ProfessionalWorldsService
from api.services.ugs.unified_generation_service import UnifiedGenerationService

logger = logging.getLogger(__name__)


def _json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, default=str)


def _row(row: Mapping[str, Any] | None) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def _rows(rows: list[Mapping[str, Any]]) -> list[dict[str, Any]]:
    return [dict(r) for r in rows]


def _guardrail_missing_required_inputs(action_row: dict[str, Any], variables: dict[str, Any]) -> str | None:
    """Validate merged variables against JSON-schema style required keys when configured."""
    schema = action_row.get("input_schema")
    if not isinstance(schema, dict):
        return None
    required = schema.get("required")
    if not isinstance(required, list):
        return None
    for key in required:
        if not isinstance(key, str):
            continue
        if key not in variables or variables[key] is None:
            return f"Missing required playbook variable: {key}"
        if variables[key] == "":
            return f"Missing required playbook variable: {key}"
    return None


def _billing_units_from_hint(hint: Any) -> float:
    """Summarize billing_hint JSON into a single comparable units number (hint-only)."""
    if not isinstance(hint, dict):
        return 0.0
    for candidate_key in ("estimated_units", "credits", "units", "cost_units"):
        raw = hint.get(candidate_key)
        if isinstance(raw, bool):
            continue
        try:
            if raw is None:
                continue
            return float(raw)
        except (TypeError, ValueError):  # fmt: skip
            continue
    return 0.0


def _extract_ugs_result_text(event: dict[str, Any]) -> str:
    """Extract readable text from a UGS result event (mirrors router helper, avoids import cycles)."""
    result = event.get("result")
    preview = event.get("result_preview")
    if isinstance(result, str):
        return result.strip()
    if isinstance(result, dict):
        for key in ("text", "content", "result", "output", "message"):
            value = result.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        if isinstance(preview, str) and preview.strip():
            return preview.strip()
        if result:
            return json.dumps(result, ensure_ascii=False, default=str)
    if isinstance(preview, str) and preview.strip():
        return preview.strip()
    return ""


async def _ugs_stream_to_text(
    *,
    user_id: UUID,
    ugs_service: UnifiedGenerationService,
    worlds: ProfessionalWorldsService,
    type_key: str,
    prompt: str,
    idempotency_key: str | None,
) -> tuple[str, UUID | None]:
    """Run a text UGS generation to completion; return body text and optional UGS request id."""
    start_payload = await ugs_service.start_generation_for_stream(
        user_id=str(user_id),
        type_key=type_key,
        input_data=worlds.build_ugs_input(prompt),
        project_id=None,
        company_id=None,
        priority=5,
        idempotency_key=idempotency_key,
    )
    if start_payload.get("status") == "completed":
        text_out = _extract_ugs_result_text(
            {
                "result": start_payload.get("result"),
                "result_preview": start_payload.get("result_preview"),
            }
        )
        if not text_out:
            msg = "UGS completed without result text"
            raise RuntimeError(msg)
        return text_out, None

    request_id = start_payload.get("request_id")
    if not request_id:
        msg = "UGS did not return request_id"
        raise RuntimeError(msg)

    async for event in ugs_service.stream_generation_events(
        str(request_id), str(user_id), poll_interval=2.5, keep_alive_interval=2.0
    ):
        event_type = str(event.get("event") or "message")
        if event_type == "keep_alive":
            continue
        if event_type == "result":
            text_out = _extract_ugs_result_text(event)
            if not text_out:
                msg = "UGS stream completed without result text"
                raise RuntimeError(msg)
            ugs_rid = event.get("request_id")
            return text_out, UUID(str(ugs_rid)) if ugs_rid else None
        if event_type == "error":
            msg = str(event.get("error") or "UGS generation failed")
            raise RuntimeError(msg)

    msg = "UGS stream finished without result"
    raise RuntimeError(msg)


class ProfessionalWorldsPlaybookService:
    """DB-backed playbook orchestration."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.worlds = ProfessionalWorldsService(db)

    async def admin_list_playbooks(self, vertical_slug: str) -> list[dict[str, Any]]:
        """List playbooks (including inactive) with ordered steps for admin surfaces."""
        result = await self.db.execute(
            text(
                """
                SELECT playbook_key, vertical_slug, display_name, description, is_active, sort_order, id
                FROM professional_ai_playbooks
                WHERE vertical_slug = :vertical_slug
                ORDER BY sort_order, playbook_key
                """
            ),
            {"vertical_slug": vertical_slug},
        )
        playbooks = _rows(list(result.mappings().all()))
        for row in playbooks:
            pid = row["id"]
            steps_r = await self.db.execute(
                text(
                    """
                    SELECT step_order, action_key, input_mapping, stop_on_error
                    FROM professional_ai_playbook_steps
                    WHERE playbook_id = :pid
                    ORDER BY step_order
                    """
                ),
                {"pid": pid},
            )
            row["steps"] = _rows(list(steps_r.mappings().all()))
            row.pop("id", None)
        return playbooks

    async def _resolve_steps_dry_run(
        self,
        vertical_slug: str,
        playbook_key: str,
        steps: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Map playbook steps to AI action metadata without calling UGS."""
        steps_out: list[dict[str, Any]] = []
        ai_svc = ProfessionalWorldsAiActionService(self.worlds)
        ordered = sorted(steps, key=lambda s: int(s.get("step_order") or 0))
        for step in ordered:
            action = await ai_svc.resolve_action(vertical_slug, str(step["action_key"]))
            mapping = step.get("input_mapping") if isinstance(step.get("input_mapping"), dict) else {}
            steps_out.append(
                {
                    "step_order": int(step["step_order"]),
                    "action_key": str(step["action_key"]),
                    "stop_on_error": bool(step.get("stop_on_error", True)),
                    "input_mapping": mapping,
                    "ugs_type_key": (action or {}).get("ugs_type_key"),
                    "display_name": (action or {}).get("display_name"),
                }
            )
        return {"playbook_key": playbook_key, "vertical_slug": vertical_slug, "steps": steps_out}

    async def admin_dry_run_playbook(
        self,
        vertical_slug: str,
        playbook_key: str,
        *,
        steps_override: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any] | None:
        """Resolve playbook steps and action metadata without calling UGS."""
        if steps_override is not None:
            return await self._resolve_steps_dry_run(vertical_slug, playbook_key, steps_override)
        playbook = await self._load_playbook(vertical_slug, playbook_key)
        if playbook is None:
            return None
        return await self._resolve_steps_dry_run(vertical_slug, playbook_key, playbook["steps"])

    async def admin_create_playbook(
        self,
        *,
        admin_user_id: UUID | None,
        vertical_slug: str,
        playbook_key: str,
        display_name: str,
        description: str | None,
        sort_order: int,
        is_active: bool,
        steps: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Insert a playbook header and ordered steps."""
        admin = ProfessionalWorldsAdminService(self.db)
        exists = await self.db.execute(
            text(
                """
                SELECT id FROM professional_ai_playbooks
                WHERE vertical_slug = :v AND playbook_key = :k
                """
            ),
            {"v": vertical_slug, "k": playbook_key},
        )
        if exists.mappings().first() is not None:
            msg = "Playbook key already exists for this vertical"
            raise ValueError(msg)

        await self.db.execute(
            text(
                """
                INSERT INTO professional_ai_playbooks (
                    vertical_slug, playbook_key, display_name, description, sort_order, is_active
                )
                VALUES (
                    :vertical_slug, :playbook_key, :display_name, :description, :sort_order, :is_active
                )
                """
            ),
            {
                "vertical_slug": vertical_slug,
                "playbook_key": playbook_key,
                "display_name": display_name,
                "description": description,
                "sort_order": sort_order,
                "is_active": is_active,
            },
        )
        res = await self.db.execute(
            text(
                """
                SELECT id FROM professional_ai_playbooks
                WHERE vertical_slug = :v AND playbook_key = :k
                """
            ),
            {"v": vertical_slug, "k": playbook_key},
        )
        pid_row = res.mappings().one()
        playbook_id = pid_row["id"]
        ordered = sorted(steps, key=lambda s: int(s.get("step_order") or 0))
        for step in ordered:
            await self.db.execute(
                text(
                    """
                    INSERT INTO professional_ai_playbook_steps (
                        playbook_id, step_order, action_key, input_mapping, stop_on_error
                    )
                    VALUES (
                        :playbook_id, :step_order, :action_key, CAST(:input_mapping AS jsonb), :stop_on_error
                    )
                    """
                ),
                {
                    "playbook_id": playbook_id,
                    "step_order": int(step["step_order"]),
                    "action_key": str(step["action_key"]),
                    "input_mapping": _json(step.get("input_mapping") or {}),
                    "stop_on_error": bool(step.get("stop_on_error", True)),
                },
            )
        await self.db.flush()
        after = await self.admin_list_playbooks(vertical_slug)
        created = next((p for p in after if p["playbook_key"] == playbook_key), None) or {}
        await admin._audit(
            admin_user_id=admin_user_id,
            action="playbook_create",
            entity_type="professional_ai_playbook",
            entity_key=f"{vertical_slug}:{playbook_key}",
            before_data=None,
            after_data=created,
            risk_level="medium",
        )
        await self.db.commit()
        return created

    async def admin_update_playbook(
        self,
        *,
        admin_user_id: UUID | None,
        vertical_slug: str,
        playbook_key: str,
        display_name: str | None = None,
        description: str | None = None,
        sort_order: int | None = None,
        is_active: bool | None = None,
        steps: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any] | None:
        """Patch playbook metadata and optionally replace steps."""
        admin = ProfessionalWorldsAdminService(self.db)
        before_list = await self.admin_list_playbooks(vertical_slug)
        before = next((p for p in before_list if p["playbook_key"] == playbook_key), None)
        if before is None:
            return None

        res = await self.db.execute(
            text(
                """
                SELECT id FROM professional_ai_playbooks
                WHERE vertical_slug = :v AND playbook_key = :k
                """
            ),
            {"v": vertical_slug, "k": playbook_key},
        )
        pid_row = res.mappings().one_or_none()
        if pid_row is None:
            return None
        playbook_id = pid_row["id"]

        sets: list[str] = ["updated_at = now()"]
        params: dict[str, Any] = {"id": playbook_id}
        header_dirty = False
        if display_name is not None:
            sets.append("display_name = :display_name")
            params["display_name"] = display_name
            header_dirty = True
        if description is not None:
            sets.append("description = :description")
            params["description"] = description
            header_dirty = True
        if sort_order is not None:
            sets.append("sort_order = :sort_order")
            params["sort_order"] = sort_order
            header_dirty = True
        if is_active is not None:
            sets.append("is_active = :is_active")
            params["is_active"] = is_active
            header_dirty = True

        if header_dirty or steps is not None:
            await self.db.execute(
                text(f"UPDATE professional_ai_playbooks SET {', '.join(sets)} WHERE id = :id"),
                params,
            )

        if steps is not None:
            await self.db.execute(
                text("DELETE FROM professional_ai_playbook_steps WHERE playbook_id = :pid"),
                {"pid": playbook_id},
            )
            ordered = sorted(steps, key=lambda s: int(s.get("step_order") or 0))
            for step in ordered:
                await self.db.execute(
                    text(
                        """
                        INSERT INTO professional_ai_playbook_steps (
                            playbook_id, step_order, action_key, input_mapping, stop_on_error
                        )
                        VALUES (
                            :playbook_id, :step_order, :action_key, CAST(:input_mapping AS jsonb), :stop_on_error
                        )
                        """
                    ),
                    {
                        "playbook_id": playbook_id,
                        "step_order": int(step["step_order"]),
                        "action_key": str(step["action_key"]),
                        "input_mapping": _json(step.get("input_mapping") or {}),
                        "stop_on_error": bool(step.get("stop_on_error", True)),
                    },
                )

        await self.db.flush()
        after_list = await self.admin_list_playbooks(vertical_slug)
        after = next((p for p in after_list if p["playbook_key"] == playbook_key), None)
        await admin._audit(
            admin_user_id=admin_user_id,
            action="playbook_update",
            entity_type="professional_ai_playbook",
            entity_key=f"{vertical_slug}:{playbook_key}",
            before_data=before,
            after_data=after,
            risk_level="medium",
        )
        await self.db.commit()
        return after

    async def list_runs(self, user_id: UUID, *, limit: int = 50) -> list[dict[str, Any]]:
        result = await self.db.execute(
            text(
                """
                SELECT id, vertical_slug, playbook_key, status, idempotency_key, step_logs, error, created_at, updated_at
                FROM professional_ai_playbook_runs
                WHERE user_id = :user_id
                ORDER BY created_at DESC
                LIMIT :limit
                """
            ),
            {"user_id": user_id, "limit": limit},
        )
        return _rows(list(result.mappings().all()))

    async def get_run(self, user_id: UUID, run_id: UUID) -> dict[str, Any] | None:
        result = await self.db.execute(
            text(
                """
                SELECT id, vertical_slug, playbook_key, status, idempotency_key, step_logs, error, created_at, updated_at
                FROM professional_ai_playbook_runs
                WHERE id = :id AND user_id = :user_id
                """
            ),
            {"id": run_id, "user_id": user_id},
        )
        row = _row(result.mappings().one_or_none())
        if row is None:
            return None
        art = await self.db.execute(
            text(
                """
                SELECT step_order, artifact_id, artifact_kind, meta
                FROM professional_ai_playbook_run_artifacts
                WHERE run_id = :run_id
                ORDER BY step_order
                """
            ),
            {"run_id": run_id},
        )
        row["artifacts"] = _rows(list(art.mappings().all()))
        return row

    async def _load_playbook_definition(
        self, vertical_slug: str, playbook_key: str, *, active_only: bool = True
    ) -> dict[str, Any] | None:
        """Load playbook header + ordered steps; optionally include inactive definitions (resume/admin)."""
        active_clause = " AND is_active = true" if active_only else ""
        result = await self.db.execute(
            text(
                f"""
                SELECT id, playbook_key, vertical_slug, display_name, description, is_active
                FROM professional_ai_playbooks
                WHERE vertical_slug = :v AND playbook_key = :k{active_clause}
                """
            ),
            {"v": vertical_slug, "k": playbook_key},
        )
        meta = _row(result.mappings().one_or_none())
        if meta is None:
            return None
        pid = meta["id"]
        steps_r = await self.db.execute(
            text(
                """
                SELECT step_order, action_key, input_mapping, stop_on_error
                FROM professional_ai_playbook_steps
                WHERE playbook_id = :pid
                ORDER BY step_order
                """
            ),
            {"pid": pid},
        )
        steps = _rows(list(steps_r.mappings().all()))
        return {"meta": meta, "steps": steps}

    async def _load_playbook(self, vertical_slug: str, playbook_key: str) -> dict[str, Any] | None:
        """Runtime playbook lookup (active catalog entries only)."""
        return await self._load_playbook_definition(vertical_slug, playbook_key, active_only=True)

    async def _find_completed_idempotent(
        self, user_id: UUID, vertical_slug: str, playbook_key: str, idempotency_key: str
    ) -> dict[str, Any] | None:
        result = await self.db.execute(
            text(
                """
                SELECT id, status
                FROM professional_ai_playbook_runs
                WHERE user_id = :user_id
                  AND vertical_slug = :v
                  AND playbook_key = :k
                  AND idempotency_key = :ik
                  AND status = 'completed'
                ORDER BY created_at DESC
                LIMIT 1
                """
            ),
            {"user_id": user_id, "v": vertical_slug, "k": playbook_key, "ik": idempotency_key},
        )
        return _row(result.mappings().one_or_none())

    async def _insert_run(
        self,
        user_id: UUID,
        vertical_slug: str,
        playbook_key: str,
        idempotency_key: str | None,
        status: str,
    ) -> UUID:
        result = await self.db.execute(
            text(
                """
                INSERT INTO professional_ai_playbook_runs (
                    user_id, vertical_slug, playbook_key, status, idempotency_key, step_logs
                )
                VALUES (
                    :user_id, :vertical_slug, :playbook_key, :status, :idempotency_key, CAST(:step_logs AS jsonb)
                )
                RETURNING id
                """
            ),
            {
                "user_id": user_id,
                "vertical_slug": vertical_slug,
                "playbook_key": playbook_key,
                "status": status,
                "idempotency_key": idempotency_key,
                "step_logs": "[]",
            },
        )
        await self.db.commit()
        row = result.mappings().one()
        return UUID(str(row["id"]))

    async def _update_run(
        self,
        run_id: UUID,
        user_id: UUID,
        *,
        status: str | None = None,
        step_logs: list[dict[str, Any]] | None = None,
        error: str | None = None,
    ) -> None:
        sets: list[str] = ["updated_at = now()"]
        params: dict[str, Any] = {"id": run_id, "user_id": user_id}
        if status is not None:
            sets.append("status = :status")
            params["status"] = status
        if step_logs is not None:
            sets.append("step_logs = CAST(:step_logs AS jsonb)")
            params["step_logs"] = _json(step_logs)
        if error is not None:
            sets.append("error = :error")
            params["error"] = error
        await self.db.execute(
            text(f"UPDATE professional_ai_playbook_runs SET {', '.join(sets)} WHERE id = :id AND user_id = :user_id"),
            params,
        )
        await self.db.commit()

    async def _link_artifact(
        self,
        run_id: UUID,
        step_order: int,
        artifact_id: UUID,
        artifact_kind: str | None,
        meta: dict[str, Any] | None,
    ) -> None:
        await self.db.execute(
            text(
                """
                INSERT INTO professional_ai_playbook_run_artifacts (
                    run_id, step_order, artifact_id, artifact_kind, meta
                )
                VALUES (
                    :run_id, :step_order, :artifact_id, :artifact_kind, CAST(:meta AS jsonb)
                )
                ON CONFLICT (run_id, step_order) DO UPDATE SET
                    artifact_id = EXCLUDED.artifact_id,
                    artifact_kind = EXCLUDED.artifact_kind,
                    meta = EXCLUDED.meta
                """
            ),
            {
                "run_id": run_id,
                "step_order": step_order,
                "artifact_id": artifact_id,
                "artifact_kind": artifact_kind,
                "meta": _json(meta or {}),
            },
        )
        await self.db.commit()

    async def stream_playbook(
        self,
        *,
        user_id: UUID,
        vertical_slug: str,
        playbook_key: str,
        variables: dict[str, Any],
        idempotency_key: str | None,
        ugs_service: UnifiedGenerationService,
        cancel_checker: Callable[[], Awaitable[bool]] | None = None,
    ) -> AsyncGenerator[tuple[str, dict[str, Any]]]:
        """Yield `(event, payload)` tuples for SSE mapping."""
        if idempotency_key:
            existing = await self._find_completed_idempotent(user_id, vertical_slug, playbook_key, idempotency_key)
            if existing:
                yield (
                    "done",
                    {
                        "run_id": str(existing["id"]),
                        "replayed": True,
                        "status": "completed",
                    },
                )
                return

        loaded = await self._load_playbook(vertical_slug, playbook_key)
        if loaded is None:
            yield "error", {"error": "Playbook not found or inactive"}
            return

        run_id = await self._insert_run(
            user_id,
            vertical_slug,
            playbook_key,
            idempotency_key,
            "running",
        )
        logger.info(
            "[STEP] professional_worlds.playbook_sse start run_id=%s vertical_slug=%s playbook_key=%s user_id=%s",
            run_id,
            vertical_slug,
            playbook_key,
            user_id,
        )
        yield "run_started", {"run_id": str(run_id), "playbook_key": playbook_key}

        step_logs: list[dict[str, Any]] = []
        ai_svc = ProfessionalWorldsAiActionService(self.worlds)

        try:
            for step in loaded["steps"]:
                if cancel_checker is not None:
                    try:
                        if await cancel_checker():
                            await self._update_run(
                                run_id,
                                user_id,
                                status="cancelled",
                                step_logs=step_logs,
                                error="cancelled_by_client",
                            )
                            logger.info(
                                "[STEP] professional_worlds.playbook_sse cancelled run_id=%s vertical_slug=%s playbook_key=%s",
                                run_id,
                                vertical_slug,
                                playbook_key,
                            )
                            yield "cancelled", {"run_id": str(run_id)}
                            return
                    except Exception as exc:  # noqa: BLE001 — cancel check must not abort the run
                        logger.debug(
                            "Playbook cancel_checker failed run_id=%s err=%s",
                            run_id,
                            exc,
                            exc_info=True,
                        )

                step_order = int(step["step_order"])
                action_key = str(step["action_key"])
                mapping = step["input_mapping"] if isinstance(step["input_mapping"], dict) else {}
                merged: dict[str, Any] = {**variables, **mapping}

                yield "step_start", {"run_id": str(run_id), "step": step_order, "action_key": action_key}
                logger.info(
                    "[STEP] professional_worlds.playbook_sse step_start run_id=%s step=%s action_key=%s",
                    run_id,
                    step_order,
                    action_key,
                )

                action_row, prompt = await ai_svc.build_prompt(
                    vertical_slug=vertical_slug,
                    action_key=action_key,
                    variables=merged,
                    fallback_prompt="",
                )
                if not action_row:
                    msg = f"AI action not found: {action_key}"
                    step_logs.append({"step": step_order, "action_key": action_key, "status": "error", "error": msg})
                    await self._update_run(run_id, user_id, status="failed", step_logs=step_logs, error=msg)
                    logger.warning(
                        "[STEP] professional_worlds.playbook_sse fail run_id=%s step=%s error=%s",
                        run_id,
                        step_order,
                        msg,
                    )
                    yield "error", {"run_id": str(run_id), "error": msg}
                    return

                guard_msg = _guardrail_missing_required_inputs(action_row, merged)
                if guard_msg:
                    step_logs.append(
                        {"step": step_order, "action_key": action_key, "status": "error", "error": guard_msg}
                    )
                    await self._update_run(run_id, user_id, status="failed", step_logs=step_logs, error=guard_msg)
                    yield "error", {"run_id": str(run_id), "step": step_order, "error": guard_msg}
                    return

                safety = action_row.get("safety_rules") or []
                if safety:
                    yield (
                        "warning",
                        {
                            "run_id": str(run_id),
                            "step": step_order,
                            "message": "Action has configured safety rules; review AI output before sending.",
                        },
                    )

                ugs_key = str(action_row.get("ugs_type_key") or "")
                if not ugs_key:
                    msg = f"Action {action_key} missing ugs_type_key"
                    step_logs.append({"step": step_order, "action_key": action_key, "status": "error", "error": msg})
                    await self._update_run(run_id, user_id, status="failed", step_logs=step_logs, error=msg)
                    yield "error", {"run_id": str(run_id), "error": msg}
                    return

                step_idem = f"{idempotency_key}:{step_order}" if idempotency_key else None
                try:
                    text_out, ugs_rid = await _ugs_stream_to_text(
                        user_id=user_id,
                        ugs_service=ugs_service,
                        worlds=self.worlds,
                        type_key=ugs_key,
                        prompt=prompt,
                        idempotency_key=step_idem,
                    )
                except Exception as exc:
                    msg = str(exc)
                    step_logs.append(
                        {
                            "step": step_order,
                            "action_key": action_key,
                            "status": "error",
                            "error": msg,
                        }
                    )
                    await self._update_run(run_id, user_id, status="failed", step_logs=step_logs, error=msg)
                    yield "error", {"run_id": str(run_id), "step": step_order, "error": msg}
                    return

                artifact = await self.worlds.save_artifact(
                    user_id=user_id,
                    source_type="playbook_step",
                    source_id=run_id,
                    recipe_key=f"playbook:{playbook_key}:{step_order}",
                    title=f"{playbook_key} · step {step_order}",
                    content=text_out,
                    artifact_data={
                        "playbook_key": playbook_key,
                        "action_key": action_key,
                        "ugs_request_id": str(ugs_rid) if ugs_rid else None,
                    },
                    module_key=str(action_row.get("module_key") or "realtor_playbooks"),
                    artifact_kind=str(action_row.get("artifact_kind") or "text"),
                    ugs_request_id=ugs_rid,
                    vertical_slug=vertical_slug,
                )
                artifact_id = UUID(str(artifact["id"]))
                await self._link_artifact(
                    run_id,
                    step_order,
                    artifact_id,
                    str(action_row.get("artifact_kind") or "text"),
                    {"action_key": action_key},
                )
                step_logs.append(
                    {
                        "step": step_order,
                        "action_key": action_key,
                        "status": "ok",
                        "artifact_id": str(artifact_id),
                    }
                )
                await self._update_run(run_id, user_id, step_logs=step_logs)
                yield (
                    "step_result",
                    {
                        "run_id": str(run_id),
                        "step": step_order,
                        "artifact_id": str(artifact_id),
                        "preview": text_out[:400],
                    },
                )

            await self._update_run(run_id, user_id, status="completed")
            logger.info(
                "[STEP] professional_worlds.playbook_sse done run_id=%s vertical_slug=%s playbook_key=%s",
                run_id,
                vertical_slug,
                playbook_key,
            )
            yield "done", {"run_id": str(run_id), "status": "completed"}
        except Exception as exc:
            msg = str(exc)
            logger.warning(
                "[STEP] professional_worlds.playbook_sse fail run_id=%s vertical_slug=%s playbook_key=%s error=%s",
                run_id,
                vertical_slug,
                playbook_key,
                msg[:240],
            )
            await self._update_run(run_id, user_id, status="failed", error=msg)
            yield "error", {"run_id": str(run_id), "error": msg}

    async def estimate_playbook_execution_cost(self, vertical_slug: str, playbook_key: str) -> dict[str, Any] | None:
        """Aggregate billing_hint totals from configured steps without invoking UGS."""
        loaded = await self._load_playbook(vertical_slug, playbook_key)
        if loaded is None:
            return None
        ai_svc = ProfessionalWorldsAiActionService(self.worlds)
        steps_out: list[dict[str, Any]] = []
        total = 0.0
        total_ugs_credits = 0.0
        for step in loaded["steps"]:
            step_order = int(step["step_order"])
            action_key = str(step["action_key"])
            action_row = await ai_svc.resolve_action(vertical_slug, action_key)
            hint_raw = (action_row or {}).get("billing_hint")
            hint = hint_raw if isinstance(hint_raw, dict) else {}
            units = _billing_units_from_hint(hint)
            ugs_type_key = str((action_row or {}).get("ugs_type_key") or "").strip()
            ugs_credits = await self._lookup_generation_type_credits(ugs_type_key)
            if ugs_credits is not None:
                total_ugs_credits += ugs_credits
                units = max(units, ugs_credits)
            total += units
            steps_out.append(
                {
                    "step_order": step_order,
                    "action_key": action_key,
                    "billing_hint": hint,
                    "estimated_units": units,
                    "ugs_credits": ugs_credits,
                    "ugs_type_key": ugs_type_key or None,
                }
            )
        return {
            "vertical_slug": vertical_slug,
            "playbook_key": playbook_key,
            "total_estimated_units": total,
            "total_ugs_credits": total_ugs_credits if total_ugs_credits > 0 else None,
            "steps": steps_out,
        }

    async def _lookup_generation_type_credits(self, ugs_type_key: str) -> float | None:
        """Resolve UGS cost_credits for a type key when registered."""
        if not ugs_type_key:
            return None
        result = await self.db.execute(
            text(
                """
                SELECT cost_credits
                FROM generation_types
                WHERE type_key = :type_key
                LIMIT 1
                """
            ),
            {"type_key": ugs_type_key},
        )
        row = result.mappings().one_or_none()
        if row is None:
            return None
        raw = row.get("cost_credits")
        try:
            if raw is None:
                return None
            return float(raw)
        except TypeError, ValueError:
            return None

    async def stream_playbook_resume(
        self,
        *,
        user_id: UUID,
        run_id: UUID,
        variables: dict[str, Any],
        ugs_service: UnifiedGenerationService,
        cancel_checker: Callable[[], Awaitable[bool]] | None = None,
    ) -> AsyncGenerator[tuple[str, dict[str, Any]]]:
        """Continue a failed/cancelled run without duplicating artifacts for completed steps."""
        row = await self.get_run(user_id, run_id)
        if row is None:
            yield "error", {"error": "Playbook run not found"}
            return
        status_val = str(row.get("status") or "")
        if status_val not in {"failed", "cancelled"}:
            yield "error", {"error": "Playbook run is not resumable"}
            return

        vertical_slug = str(row["vertical_slug"])
        playbook_key = str(row["playbook_key"])
        loaded = await self._load_playbook_definition(vertical_slug, playbook_key, active_only=False)
        if loaded is None:
            yield "error", {"error": "Playbook definition missing"}
            return

        logs_raw = row.get("step_logs")
        step_logs: list[dict[str, Any]]
        if logs_raw is None:
            step_logs = []
        elif isinstance(logs_raw, str):
            step_logs = list(json.loads(logs_raw)) if logs_raw else []
        elif isinstance(logs_raw, list):
            step_logs = [e for e in logs_raw if isinstance(e, dict)]
        else:
            step_logs = []

        step_logs = [e for e in step_logs if e.get("status") == "ok"]
        completed_steps: dict[int, str] = {}
        for entry in step_logs:
            step_no = entry.get("step")
            artifact_id = entry.get("artifact_id")
            if step_no is not None and artifact_id:
                completed_steps[int(step_no)] = str(artifact_id)

        await self._update_run(run_id, user_id, status="running", step_logs=step_logs, error=None)
        yield "resume_started", {"run_id": str(run_id), "playbook_key": playbook_key}

        ai_svc = ProfessionalWorldsAiActionService(self.worlds)

        try:
            for step in loaded["steps"]:
                if cancel_checker is not None:
                    try:
                        if await cancel_checker():
                            await self._update_run(
                                run_id,
                                user_id,
                                status="cancelled",
                                step_logs=step_logs,
                                error="cancelled_by_client",
                            )
                            logger.info(
                                "[STEP] professional_worlds.playbook_sse cancelled run_id=%s vertical_slug=%s playbook_key=%s",
                                run_id,
                                vertical_slug,
                                playbook_key,
                            )
                            yield "cancelled", {"run_id": str(run_id)}
                            return
                    except Exception as exc:  # noqa: BLE001 — cancel check must not abort the run
                        logger.debug(
                            "Playbook cancel_checker failed run_id=%s err=%s",
                            run_id,
                            exc,
                            exc_info=True,
                        )

                step_order = int(step["step_order"])
                action_key = str(step["action_key"])
                mapping = step["input_mapping"] if isinstance(step["input_mapping"], dict) else {}
                merged: dict[str, Any] = {**variables, **mapping}

                if step_order in completed_steps:
                    yield (
                        "step_skipped",
                        {
                            "run_id": str(run_id),
                            "step": step_order,
                            "artifact_id": completed_steps[step_order],
                            "reason": "reuse_previous_success",
                        },
                    )
                    continue

                yield "step_start", {"run_id": str(run_id), "step": step_order, "action_key": action_key}

                action_row, prompt = await ai_svc.build_prompt(
                    vertical_slug=vertical_slug,
                    action_key=action_key,
                    variables=merged,
                    fallback_prompt="",
                )
                if not action_row:
                    msg = f"AI action not found: {action_key}"
                    step_logs.append({"step": step_order, "action_key": action_key, "status": "error", "error": msg})
                    await self._update_run(run_id, user_id, status="failed", step_logs=step_logs, error=msg)
                    yield "error", {"run_id": str(run_id), "error": msg}
                    return

                guard_msg = _guardrail_missing_required_inputs(action_row, merged)
                if guard_msg:
                    step_logs.append(
                        {"step": step_order, "action_key": action_key, "status": "error", "error": guard_msg}
                    )
                    await self._update_run(run_id, user_id, status="failed", step_logs=step_logs, error=guard_msg)
                    yield "error", {"run_id": str(run_id), "step": step_order, "error": guard_msg}
                    return

                safety = action_row.get("safety_rules") or []
                if safety:
                    yield (
                        "warning",
                        {
                            "run_id": str(run_id),
                            "step": step_order,
                            "message": "Action has configured safety rules; review AI output before sending.",
                        },
                    )

                ugs_key = str(action_row.get("ugs_type_key") or "")
                if not ugs_key:
                    msg = f"Action {action_key} missing ugs_type_key"
                    step_logs.append({"step": step_order, "action_key": action_key, "status": "error", "error": msg})
                    await self._update_run(run_id, user_id, status="failed", step_logs=step_logs, error=msg)
                    yield "error", {"run_id": str(run_id), "error": msg}
                    return

                try:
                    text_out, ugs_rid = await _ugs_stream_to_text(
                        user_id=user_id,
                        ugs_service=ugs_service,
                        worlds=self.worlds,
                        type_key=ugs_key,
                        prompt=prompt,
                        idempotency_key=f"resume:{run_id}:{step_order}",
                    )
                except Exception as exc:
                    msg = str(exc)
                    step_logs.append(
                        {
                            "step": step_order,
                            "action_key": action_key,
                            "status": "error",
                            "error": msg,
                        }
                    )
                    await self._update_run(run_id, user_id, status="failed", step_logs=step_logs, error=msg)
                    yield "error", {"run_id": str(run_id), "step": step_order, "error": msg}
                    return

                artifact = await self.worlds.save_artifact(
                    user_id=user_id,
                    source_type="playbook_step",
                    source_id=run_id,
                    recipe_key=f"playbook:{playbook_key}:{step_order}",
                    title=f"{playbook_key} · step {step_order}",
                    content=text_out,
                    artifact_data={
                        "playbook_key": playbook_key,
                        "action_key": action_key,
                        "ugs_request_id": str(ugs_rid) if ugs_rid else None,
                    },
                    module_key=str(action_row.get("module_key") or "realtor_playbooks"),
                    artifact_kind=str(action_row.get("artifact_kind") or "text"),
                    ugs_request_id=ugs_rid,
                    vertical_slug=vertical_slug,
                )
                artifact_id = UUID(str(artifact["id"]))
                await self._link_artifact(
                    run_id,
                    step_order,
                    artifact_id,
                    str(action_row.get("artifact_kind") or "text"),
                    {"action_key": action_key},
                )
                step_logs.append(
                    {
                        "step": step_order,
                        "action_key": action_key,
                        "status": "ok",
                        "artifact_id": str(artifact_id),
                    }
                )
                completed_steps[step_order] = str(artifact_id)
                await self._update_run(run_id, user_id, step_logs=step_logs)
                yield (
                    "step_result",
                    {
                        "run_id": str(run_id),
                        "step": step_order,
                        "artifact_id": str(artifact_id),
                        "preview": text_out[:400],
                    },
                )

            await self._update_run(run_id, user_id, status="completed")
            yield "done", {"run_id": str(run_id), "status": "completed"}
        except Exception as exc:
            msg = str(exc)
            await self._update_run(run_id, user_id, status="failed", error=msg)
            yield "error", {"run_id": str(run_id), "error": msg}

    async def eval_run_playbook_steps(
        self,
        *,
        user_id: UUID,
        vertical_slug: str,
        playbook_key: str,
        variables: dict[str, Any],
        ugs_service: UnifiedGenerationService,
        idempotency_prefix: str | None,
    ) -> tuple[str, list[dict[str, Any]]]:
        """Execute playbook steps without persisting playbook runs or artifacts (admin evaluation)."""
        loaded = await self._load_playbook(vertical_slug, playbook_key)
        if loaded is None:
            raise ValueError("playbook_not_found")

        ai_svc = ProfessionalWorldsAiActionService(self.worlds)
        chunks: list[str] = []
        details: list[dict[str, Any]] = []

        for step in loaded["steps"]:
            step_order = int(step["step_order"])
            action_key = str(step["action_key"])
            mapping = step["input_mapping"] if isinstance(step["input_mapping"], dict) else {}
            merged: dict[str, Any] = {**variables, **mapping}

            action_row, prompt = await ai_svc.build_prompt(
                vertical_slug=vertical_slug,
                action_key=action_key,
                variables=merged,
                fallback_prompt="",
            )
            if not action_row:
                raise ValueError(f"missing_action:{action_key}")
            ugs_key = str(action_row.get("ugs_type_key") or "")
            if not ugs_key:
                raise ValueError(f"missing_ugs_type:{action_key}")

            step_idem = f"{idempotency_prefix}:{step_order}" if idempotency_prefix else None
            text_out, ugs_rid = await _ugs_stream_to_text(
                user_id=user_id,
                ugs_service=ugs_service,
                worlds=self.worlds,
                type_key=ugs_key,
                prompt=prompt,
                idempotency_key=step_idem,
            )
            chunks.append(text_out)
            details.append(
                {
                    "step": step_order,
                    "action_key": action_key,
                    "ugs_request_id": str(ugs_rid) if ugs_rid else None,
                }
            )

        return "\n\n".join(chunks), details
