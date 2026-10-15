"""Дайджест недавних AMKA-прогонов и правка аудита под сущности проекта."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from api.routers.marketing_cabinet.common import get_accessible_project
from api.services.marketing_cabinet.amka_service_support import (
    AMKA_AUDIT_ONLY_SECTIONS,
    _row_dict_for_amka_digest,
)


async def load_recent_amka_runs_digest(
    svc: Any,
    *,
    project_id: UUID,
    user_id: UUID,
    exclude_run_id: UUID | None,
    limit: int = 3,
) -> list[dict[str, Any]]:
    """Последние завершённые запуски AMKA по проекту (для промпта и UI)."""
    await get_accessible_project(svc._db_pool, project_id, user_id, for_mutation=False)
    lim = max(1, min(int(limit), 10))
    async with svc._db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, status, completed_at, created_at, master_plan_summary,
                   final_summary_markdown, final_assessment
            FROM marketing_amka_runs
            WHERE project_id = $1
              AND deleted_at IS NULL
              AND completed_at IS NOT NULL
              AND ($2::uuid IS NULL OR id <> $2)
            ORDER BY created_at DESC
            LIMIT $3
            """,
            project_id,
            exclude_run_id,
            lim,
        )
    return [_row_dict_for_amka_digest(r) for r in rows]


def apply_entity_edit_bias_to_audits(
    svc: Any,
    audits: list[dict[str, Any]],
    snapshot: dict[str, Any],
) -> None:
    raw_entities = snapshot.get("section_entities")
    if not isinstance(raw_entities, dict):
        return
    bias_line = (
        "В кабинете уже есть сущности в этом разделе — в плане приоритет update/replace/status_transition "
        "по entity_id из current entities; create только при явной нехватке данных."
    )
    for audit in audits:
        payload = audit.get("report_payload")
        if not isinstance(payload, dict):
            continue
        sk = str(payload.get("section_key") or "").strip()
        if not sk or sk in AMKA_AUDIT_ONLY_SECTIONS:
            continue
        bucket = raw_entities.get(sk)
        if not isinstance(bucket, list) or not bucket:
            continue
        wn = [str(x) for x in list(payload.get("work_needed") or []) if str(x).strip()]
        if bias_line not in wn:
            wn.append(bias_line)
        merged = dict(payload)
        merged["work_needed"] = wn[:6]
        audit["report_payload"] = merged
        audit["report_markdown"] = svc._render_audit_markdown(merged)
