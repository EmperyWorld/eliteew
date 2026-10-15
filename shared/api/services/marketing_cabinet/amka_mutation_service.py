# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Apply AMKA execute-step mutations (CRUD, autofill bridges, RAG attach) against marketing cabinet entities.
# Invariants:
# - Entity types accepted here must match router layer contracts and AMKA operation kinds.
# - Router create/update returns Pydantic ``*Out`` models; ``_mutation_result`` coerces them to dict snapshots.
# - Project autofill uses ``amka_llm_json_raw`` (stack2 ``format=json``), not free-text ``amka_llm_text``.
# - Unknown entity_type / kind raises before partial DB writes (where the callee enforces transactional boundaries).
# - Segment linked_* fields resolve via project DB lookup (titles/names); raw LLM UUID strings are verified, not trusted.
# Related:
# - amka_phase_execute_section.py, researches.py (research / evidence)
# ---
from __future__ import annotations

import json
import logging
import re
from collections import defaultdict
from collections.abc import Awaitable, Callable
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]
from fastapi import HTTPException  # type: ignore[import-untyped]

from api.routers.marketing_cabinet.analysis import (
    SWOTUpdateRequest,
    _create_swot_analysis,
    _fetch_swot,
    _fetch_swot_factors,
    delete_swot_analysis,
)
from api.routers.marketing_cabinet.campaigns import (
    CampaignCreateRequest,
    CampaignUpdateRequest,
    _fetch_campaign,
    create_campaign,
    delete_campaign,
    update_campaign,
)
from api.routers.marketing_cabinet.common import (
    get_accessible_project,
    normalize_alert,
    normalize_campaign,
    normalize_competitor,
    normalize_funnel,
    normalize_funnel_stage,
    normalize_job_story,
    normalize_research,
    normalize_segment,
    normalize_swot_analysis,
    normalize_task,
    normalize_value_proposition,
)
from api.routers.marketing_cabinet.competitors import (
    CompetitorCreateRequest,
    CompetitorUpdateRequest,
    _fetch_competitor,
    create_competitor,
    delete_competitor,
    update_competitor,
)
from api.routers.marketing_cabinet.document_autofill import (
    AutofillTarget,
    _build_lookup_indexes,
    _build_preview_result_payload,
    _build_prompt_project_only,
    _coerce_string_list,
    _resolve_linked_ids,
    _synthetic_project_source_content_item,
    apply_project_autofill_preview_to_entities,
    sanitize_generated_duplicate_markers,
)
from api.routers.marketing_cabinet.funnels import (
    FunnelCreateRequest,
    FunnelStageInput,
    FunnelUpdateRequest,
    _fetch_funnel,
    _fetch_funnel_stages,
    create_funnel,
    delete_funnel,
    update_funnel,
)
from api.routers.marketing_cabinet.jtbd import (
    JobStoryCreateRequest,
    JobStoryUpdateRequest,
    _fetch_job_story,
    create_job_story,
    delete_job_story,
    update_job_story,
)
from api.routers.marketing_cabinet.operations import (
    AlertCreateRequest,
    AlertUpdateRequest,
    TaskCreateRequest,
    TaskUpdateRequest,
    _fetch_alert,
    _fetch_task,
    create_alert,
    create_task,
    delete_alert,
    delete_task,
    update_alert,
    update_task,
)
from api.routers.marketing_cabinet.researches import (
    ResearchCreateRequest,
    ResearchUpdateRequest,
    _fetch_research,
    create_research,
    delete_research,
    update_research,
)
from api.routers.marketing_cabinet.segments import (
    SegmentCreateRequest,
    SegmentUpdateRequest,
    _fetch_segment,
    create_segment,
    delete_segment,
    update_segment,
)
from api.routers.marketing_cabinet.value_proposition import (
    ValuePropositionCreateRequest,
    ValuePropositionUpdateRequest,
    _fetch_value_proposition,
    create_value_proposition,
    delete_value_proposition,
    update_value_proposition,
)
from api.services.marketing_cabinet.amka_llm_runtime import amka_llm_json_raw
from api.services.marketing_project_rag_service import (
    MIN_EXTRACTED_TEXT_CHARS,
    index_unified_content_marketing_rag,
)
from api.services.marketing_project_rag_sources_service import patch_marketing_rag_source_inclusion

SupportedOperationKind = str

SUPPORTED_OPERATION_KINDS: frozenset[str] = frozenset(
    {
        "create",
        "update",
        "replace",
        "delete",
        "archive",
        "status_transition",
        "import_analysis_artifact",
        "attach_content_source",
        "reindex_marketing_rag_content",
    }
)

SECTION_ENTITY_TYPES: dict[str, tuple[str, ...]] = {
    "jtbd": ("job_story",),
    "value": ("value_proposition",),
    "analysis": ("swot_analysis", "competitor"),
    "segments": ("segment",),
    "campaigns": ("campaign",),
    "funnel": ("funnel",),
    "tasks": ("task",),
    "alerts": ("alert",),
    "client_interaction": ("customer_facing_summary",),
}

ENTITY_AUTOFILL_TARGETS: dict[str, AutofillTarget] = {
    "job_story": AutofillTarget.JTBD,
    "value_proposition": AutofillTarget.VALUE_PROPOSITIONS,
    "swot_analysis": AutofillTarget.SWOT,
    "competitor": AutofillTarget.COMPETITORS,
    "segment": AutofillTarget.SEGMENTS,
    "campaign": AutofillTarget.CAMPAIGNS,
    "funnel": AutofillTarget.FUNNELS,
    "task": AutofillTarget.TASKS,
    "alert": AutofillTarget.ALERTS,
}

logger = logging.getLogger(__name__)

_AMKA_AUTOFILL_MAX_TRIES = 3
_AMKA_AUTOFILL_CONTEXT_TRIM = 10_000
_AMKA_AUTOFILL_CONTEXT_TRIM_AGGRESSIVE = 6_000
_FUNNEL_UPDATE_FALLBACK_STAGES: tuple[str, ...] = (
    "Awareness",
    "Consideration",
    "Qualification",
    "Consultation",
    "Proposal",
    "Closed won",
)


def _sanitize_generated_preview_payload(value: Any) -> Any:  # noqa: ANN401
    if isinstance(value, dict):
        return {str(key): _sanitize_generated_preview_payload(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_sanitize_generated_preview_payload(item) for item in value]
    return sanitize_generated_duplicate_markers(value)


def _autofill_preview_error_status(detail: str, *, final_attempt: bool) -> str:
    d = detail.casefold()
    if "невалидный json" in d:
        return "retry_exhausted" if final_attempt else "invalid_json"
    if "не нашёл пригодных элементов" in d or "отсеяны по форме" in d or "preview" in d:
        return "retry_exhausted" if final_attempt else "no_preview"
    return "failed"


def _autofill_error_is_retryable(detail: str) -> bool:
    return _autofill_preview_error_status(detail, final_attempt=False) in {"invalid_json", "no_preview"}


def _truncate_project_context_for_autofill_retry(project_context_text: str, *, max_chars: int) -> str:
    t = project_context_text.strip()
    if len(t) <= max_chars:
        return t
    return (
        t[: max_chars - 200] + "\n\n[Системное примечание: контекст сокращён для повторной генерации. "
        "Верни один компактный JSON-объект с ключами summary, warnings, items — без markdown и текста вне JSON.]\n"
    )


async def _merge_segment_autofill_preview_links(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    replace_entity_id: str,
    result_payload: dict[str, Any],
) -> None:
    """Если модель не вернула связи, сохраняем существующие linked_job_story / competitor из заменяемого сегмента."""
    try:
        seg_uuid = UUID(str(replace_entity_id).strip())
    except ValueError:
        return
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            SELECT linked_job_story_ids, linked_competitor_ids
            FROM marketing_segments
            WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL
            """,
            seg_uuid,
            project_id,
        )
        if not row:
            return
        job_ids = [x for x in (row["linked_job_story_ids"] or []) if x]
        comp_ids = [x for x in (row["linked_competitor_ids"] or []) if x]
        job_titles: list[str] = []
        if job_ids:
            jrows = await conn.fetch(
                """
                SELECT COALESCE(metadata->>'title', situation, '') AS t
                FROM job_stories
                WHERE project_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL
                """,
                project_id,
                job_ids,
            )
            job_titles = [str(r["t"]).strip() for r in jrows if (r["t"] or "").strip()]
        comp_names: list[str] = []
        if comp_ids:
            crows = await conn.fetch(
                """
                SELECT name FROM competitors
                WHERE project_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL
                """,
                project_id,
                comp_ids,
            )
            comp_names = [str(r["name"]).strip() for r in crows if (r["name"] or "").strip()]
    for p in result_payload.get("preview_items") or []:
        pl = p.get("payload")
        if not isinstance(pl, dict):
            continue
        titles = pl.get("linked_job_story_titles")
        if isinstance(titles, list) and len(titles) == 0 and job_titles:
            pl["linked_job_story_titles"] = list(job_titles)
        names = pl.get("linked_competitor_names")
        if isinstance(names, list) and len(names) == 0 and comp_names:
            pl["linked_competitor_names"] = list(comp_names)


def _trim_text(value: Any, max_len: int = 220) -> str:
    text = str(value or "").strip()
    if len(text) <= max_len:
        return text
    return f"{text[: max_len - 1]}…"


def _json_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


def _json_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    return []


def _safe_nonnegative_int(value: Any) -> int:
    try:
        return max(0, int(value or 0))
    except TypeError, ValueError:
        return 0


def _as_mutation_snapshot(item: Any) -> dict[str, Any]:
    """Normalize router create/update return value to a plain dict for mutation result payloads.

    Cabinet routers return Pydantic ``*Out`` models; some internal helpers still return dicts.
    """
    if isinstance(item, dict):
        return item
    model_dump = getattr(item, "model_dump", None)
    if callable(model_dump):
        dumped = model_dump(mode="json")
        if isinstance(dumped, dict):
            return dumped
    raise TypeError(f"Mutation result expected dict or pydantic model, got {type(item)!r}")


def _entity_ref(entity_type: str, snapshot: dict[str, Any]) -> dict[str, Any]:
    return {
        "entity_type": entity_type,
        "entity_id": str(snapshot.get("id") or ""),
        "title": str(snapshot.get("title") or snapshot.get("name") or snapshot.get("headline") or entity_type),
        "status": snapshot.get("status"),
    }


def _first_nonempty(*values: Any) -> str:
    for value in values:
        text = str(value or "").strip()
        if text:
            return text
    return ""


_AUTOFILL_META_KEYS: frozenset[str] = frozenset({"mode", "autofill_target", "project_id"})


def _is_project_autofill_operation(payload: dict[str, Any], replacement_payload: dict[str, Any]) -> bool:
    if payload.get("mode") == "project_autofill" or replacement_payload.get("mode") == "project_autofill":
        return True
    return bool(_first_nonempty(payload.get("autofill_target"), replacement_payload.get("autofill_target")))


def _strip_autofill_meta_keys(payload: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in payload.items() if key not in _AUTOFILL_META_KEYS}


def _normalize_competitor_mutation_payload(payload: dict[str, Any], *, require_name: bool = True) -> dict[str, Any]:
    cleaned = _strip_autofill_meta_keys(dict(payload))
    name = _first_nonempty(
        cleaned.get("name"),
        cleaned.get("title"),
        cleaned.get("company_name"),
        cleaned.get("competitor_name"),
        cleaned.get("headline"),
    )
    if name:
        cleaned["name"] = name
    elif require_name:
        cleaned["name"] = "Конкурент (AMKA)"
    for alias in ("title", "company_name", "competitor_name", "headline"):
        cleaned.pop(alias, None)
    return cleaned


_UUID_WS_RE = re.compile(r"[\s\xa0\u200b\u00ad]+")

_SEGMENT_JOB_TITLE_KEYS: tuple[str, ...] = (
    "linked_job_story_titles",
    "job_story_titles",
    "job_story_names",
)
_SEGMENT_COMPETITOR_NAME_KEYS: tuple[str, ...] = (
    "linked_competitor_names",
    "competitor_names",
)


def _try_parse_uuid(value: object) -> UUID | None:
    if isinstance(value, UUID):
        return value
    candidate = _UUID_WS_RE.sub("", str(value).strip())
    if not candidate:
        return None
    try:
        return UUID(candidate)
    except ValueError:
        return None


def _coerce_uuid_candidates(values: object) -> list[UUID]:
    resolved: list[UUID] = []
    seen: set[UUID] = set()
    for raw in _coerce_string_list(values):
        parsed = _try_parse_uuid(raw)
        if parsed and parsed not in seen:
            resolved.append(parsed)
            seen.add(parsed)
    return resolved


def _merge_uuid_lists(*groups: list[UUID]) -> list[UUID]:
    merged: list[UUID] = []
    seen: set[UUID] = set()
    for group in groups:
        for entity_id in group:
            if entity_id not in seen:
                merged.append(entity_id)
                seen.add(entity_id)
    return merged


async def _filter_ids_for_project(
    conn: asyncpg.Connection,
    *,
    project_id: UUID,
    entity: str,
    candidate_ids: list[UUID],
) -> list[UUID]:
    if not candidate_ids:
        return []
    if entity == "jobs":
        query = """
            SELECT id FROM job_stories
            WHERE project_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL
        """
    elif entity == "competitors":
        query = """
            SELECT id FROM competitors
            WHERE project_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL
        """
    elif entity == "content":
        query = """
            SELECT id FROM unified_content
            WHERE project_id = $1 AND id = ANY($2::uuid[]) AND deleted_at IS NULL
        """
    else:
        return []
    rows = await conn.fetch(query, project_id, candidate_ids)
    found = {row["id"] for row in rows}
    verified: list[UUID] = []
    seen: set[UUID] = set()
    for entity_id in candidate_ids:
        if entity_id in found and entity_id not in seen:
            verified.append(entity_id)
            seen.add(entity_id)
    return verified


def _apply_resolved_segment_link_field(
    cleaned: dict[str, Any],
    *,
    field_name: str,
    original_payload: dict[str, Any],
    for_create: bool,
    title_resolved: list[UUID],
    verified_ids: list[UUID],
    titles_provided: bool,
    raw_ids_provided: bool,
) -> None:
    if titles_provided:
        cleaned[field_name] = _merge_uuid_lists(title_resolved, verified_ids)
        return
    if raw_ids_provided:
        original_raw = original_payload.get(field_name)
        if isinstance(original_raw, list) and len(original_raw) == 0:
            cleaned[field_name] = []
            return
        if verified_ids:
            cleaned[field_name] = verified_ids
            return
        if for_create:
            cleaned[field_name] = []
        return
    cleaned.pop(field_name, None)


async def _resolve_segment_mutation_payload(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    payload: dict[str, Any],
    for_create: bool = False,
) -> dict[str, Any]:
    """Resolve segment linked_* fields via project DB indexes; never pass corrupted LLM UUID strings to Pydantic."""
    original_payload = dict(payload)
    cleaned = _strip_autofill_meta_keys(dict(payload))

    job_titles: list[str] = []
    for key in _SEGMENT_JOB_TITLE_KEYS:
        job_titles.extend(_coerce_string_list(cleaned.pop(key, None)))

    competitor_names: list[str] = []
    for key in _SEGMENT_COMPETITOR_NAME_KEYS:
        competitor_names.extend(_coerce_string_list(cleaned.pop(key, None)))

    raw_job_ids = _coerce_uuid_candidates(cleaned.pop("linked_job_story_ids", None))
    raw_competitor_ids = _coerce_uuid_candidates(cleaned.pop("linked_competitor_ids", None))
    raw_content_ids = _coerce_uuid_candidates(cleaned.pop("linked_content_ids", None))

    async with db_pool.acquire() as conn:
        lookup_indexes = await _build_lookup_indexes(conn, project_id=project_id)
        title_job_ids = _resolve_linked_ids(job_titles, lookup_indexes["jobs"])
        title_competitor_ids = _resolve_linked_ids(competitor_names, lookup_indexes["competitors"])
        verified_job_ids = await _filter_ids_for_project(
            conn, project_id=project_id, entity="jobs", candidate_ids=raw_job_ids
        )
        verified_competitor_ids = await _filter_ids_for_project(
            conn, project_id=project_id, entity="competitors", candidate_ids=raw_competitor_ids
        )
        verified_content_ids = await _filter_ids_for_project(
            conn, project_id=project_id, entity="content", candidate_ids=raw_content_ids
        )

    _apply_resolved_segment_link_field(
        cleaned,
        field_name="linked_job_story_ids",
        original_payload=original_payload,
        for_create=for_create,
        title_resolved=title_job_ids,
        verified_ids=verified_job_ids,
        titles_provided=bool(job_titles),
        raw_ids_provided="linked_job_story_ids" in original_payload,
    )
    _apply_resolved_segment_link_field(
        cleaned,
        field_name="linked_competitor_ids",
        original_payload=original_payload,
        for_create=for_create,
        title_resolved=title_competitor_ids,
        verified_ids=verified_competitor_ids,
        titles_provided=bool(competitor_names),
        raw_ids_provided="linked_competitor_ids" in original_payload,
    )
    if "linked_content_ids" in original_payload:
        original_raw = original_payload.get("linked_content_ids")
        if isinstance(original_raw, list) and len(original_raw) == 0:
            cleaned["linked_content_ids"] = []
        elif verified_content_ids:
            cleaned["linked_content_ids"] = verified_content_ids
        elif for_create:
            cleaned["linked_content_ids"] = []
    else:
        cleaned.pop("linked_content_ids", None)

    return cleaned


def _infer_archive_status(entity_type: str, payload: dict[str, Any]) -> str:
    explicit = str(payload.get("status") or "").strip()
    if explicit:
        return explicit
    return {
        "value_proposition": "archived",
        "segment": "archived",
        "campaign": "archived",
        "funnel": "archived",
        "task": "cancelled",
        "alert": "resolved",
        "research": "archived",
    }.get(entity_type, "archived")


def _canonical_mutation_entity_type(entity_type: str) -> str:
    """Map LLM/plan synonyms to router entity keys (e.g. evidence_document → research)."""
    if entity_type == "evidence_document":
        return "research"
    return entity_type


class AmkaMutationService:
    def __init__(self, db_pool: asyncpg.Pool) -> None:
        self._db_pool = db_pool

    async def list_project_entities(self, *, project_id: UUID, user_id: UUID) -> dict[str, list[dict[str, Any]]]:
        await get_accessible_project(self._db_pool, project_id, user_id, for_mutation=False)
        async with self._db_pool.acquire() as conn:
            jtbd_rows = await conn.fetch(
                """
                SELECT
                    id,
                    project_id,
                    company_id,
                    situation,
                    motivation,
                    outcome,
                    full_story,
                    category::text AS category,
                    priority::text AS priority,
                    tags,
                    source::text AS source,
                    importance_score,
                    quality_score,
                    sentiment_score,
                    is_validated,
                    metadata,
                    processing_data,
                    created_at,
                    updated_at,
                    COALESCE((processing_data->>'satisfaction_score')::numeric, NULL) AS satisfaction_score,
                    COALESCE(metadata->>'title', situation) AS title
                FROM job_stories
                WHERE project_id = $1
                  AND deleted_at IS NULL
                ORDER BY updated_at DESC NULLS LAST, created_at DESC
                LIMIT 24
                """,
                project_id,
            )
            value_rows = await conn.fetch(
                """
                SELECT *
                FROM value_propositions
                WHERE project_id = $1
                  AND deleted_at IS NULL
                ORDER BY updated_at DESC NULLS LAST, created_at DESC
                LIMIT 12
                """,
                project_id,
            )
            swot_rows = await conn.fetch(
                """
                SELECT *
                FROM swot_analyses
                WHERE project_id = $1
                  AND deleted_at IS NULL
                ORDER BY updated_at DESC NULLS LAST, created_at DESC
                LIMIT 12
                """,
                project_id,
            )
            competitor_rows = await conn.fetch(
                """
                SELECT *
                FROM competitors
                WHERE project_id = $1
                  AND deleted_at IS NULL
                ORDER BY updated_at DESC NULLS LAST, created_at DESC
                LIMIT 24
                """,
                project_id,
            )
            segment_rows = await conn.fetch(
                """
                SELECT *
                FROM marketing_segments
                WHERE project_id = $1
                  AND deleted_at IS NULL
                ORDER BY updated_at DESC NULLS LAST, created_at DESC
                LIMIT 24
                """,
                project_id,
            )
            campaign_rows = await conn.fetch(
                """
                SELECT *
                FROM marketing_campaigns
                WHERE project_id = $1
                  AND deleted_at IS NULL
                ORDER BY updated_at DESC NULLS LAST, created_at DESC
                LIMIT 24
                """,
                project_id,
            )
            funnel_rows = await conn.fetch(
                """
                SELECT *
                FROM marketing_funnels
                WHERE project_id = $1
                  AND deleted_at IS NULL
                ORDER BY updated_at DESC NULLS LAST, created_at DESC
                LIMIT 12
                """,
                project_id,
            )
            task_rows = await conn.fetch(
                """
                SELECT *
                FROM marketing_tasks
                WHERE project_id = $1
                  AND deleted_at IS NULL
                ORDER BY updated_at DESC NULLS LAST, created_at DESC
                LIMIT 24
                """,
                project_id,
            )
            alert_rows = await conn.fetch(
                """
                SELECT *
                FROM marketing_alerts
                WHERE project_id = $1
                  AND deleted_at IS NULL
                ORDER BY updated_at DESC NULLS LAST, created_at DESC
                LIMIT 24
                """,
                project_id,
            )
            research_rows = await conn.fetch(
                """
                SELECT *
                FROM research_projects
                WHERE project_id = $1
                  AND deleted_at IS NULL
                ORDER BY updated_at DESC NULLS LAST, created_at DESC
                LIMIT 24
                """,
                project_id,
            )
            summary_row = await conn.fetchrow(
                """
                SELECT project_id, payload, updated_at
                FROM marketing_customer_facing_summary
                WHERE project_id = $1
                """,
                project_id,
            )

        swot_ids = [row["id"] for row in swot_rows]
        factors_by_swot_id: dict[UUID, list[dict[str, Any]]] = defaultdict(list)
        if swot_ids:
            async with self._db_pool.acquire() as conn:
                factor_rows = await conn.fetch(
                    """
                    SELECT *
                    FROM swot_factors
                    WHERE swot_analysis_id = ANY($1::uuid[])
                      AND deleted_at IS NULL
                    ORDER BY priority_score DESC, created_at ASC
                    """,
                    swot_ids,
                )
            for row in factor_rows:
                factors_by_swot_id[row["swot_analysis_id"]].append(
                    {
                        "id": str(row["id"]),
                        "factor_type": row.get("factor_type"),
                        "factor_text": row.get("factor_text"),
                        "description": row.get("description"),
                        "impact_level": row.get("impact_level"),
                        "priority_score": row.get("priority_score") or 0,
                        "ai_generated": bool(row.get("ai_generated")),
                        "confidence_score": row.get("confidence_score"),
                        "ai_reasoning": row.get("ai_reasoning"),
                    }
                )

        funnel_ids = [row["id"] for row in funnel_rows]
        stages_by_funnel_id: dict[UUID, list[dict[str, Any]]] = defaultdict(list)
        if funnel_ids:
            async with self._db_pool.acquire() as conn:
                stage_rows = await conn.fetch(
                    """
                    SELECT *
                    FROM marketing_funnel_stages
                    WHERE funnel_id = ANY($1::uuid[])
                      AND deleted_at IS NULL
                    ORDER BY stage_order ASC, created_at ASC
                    """,
                    funnel_ids,
                )
            for row in stage_rows:
                stages_by_funnel_id[row["funnel_id"]].append(normalize_funnel_stage(row))

        entities = {
            "jtbd": [self._to_entity_brief("job_story", normalize_job_story(row)) for row in jtbd_rows],
            "value": [
                self._to_entity_brief("value_proposition", normalize_value_proposition(row)) for row in value_rows
            ],
            "analysis": [
                *[
                    self._to_entity_brief(
                        "swot_analysis",
                        normalize_swot_analysis(row, factors_by_swot_id.get(row["id"], [])),
                    )
                    for row in swot_rows
                ],
                *[self._to_entity_brief("competitor", normalize_competitor(row)) for row in competitor_rows],
            ],
            "segments": [self._to_entity_brief("segment", normalize_segment(row)) for row in segment_rows],
            "campaigns": [self._to_entity_brief("campaign", normalize_campaign(row)) for row in campaign_rows],
            "funnel": [
                self._to_entity_brief("funnel", normalize_funnel(row, stages_by_funnel_id.get(row["id"], [])))
                for row in funnel_rows
            ],
            "tasks": [self._to_entity_brief("task", normalize_task(row)) for row in task_rows],
            "alerts": [self._to_entity_brief("alert", normalize_alert(row)) for row in alert_rows],
            "evidence": [self._to_entity_brief("research", normalize_research(row)) for row in research_rows],
            "client_interaction": [],
        }
        if summary_row is not None:
            payload = _json_dict(summary_row.get("payload"))
            entities["client_interaction"].append(
                self._to_entity_brief(
                    "customer_facing_summary",
                    {
                        "id": str(project_id),
                        "project_id": str(project_id),
                        "title": _first_nonempty(payload.get("headline"), "Сводка для заказчика"),
                        "status": "active",
                        "payload": payload,
                        "updated_at": summary_row.get("updated_at").isoformat()
                        if summary_row.get("updated_at")
                        else None,
                    },
                )
            )
        return entities

    def supports_operation(self, operation: dict[str, Any]) -> bool:
        kind = str(operation.get("kind") or "").strip()
        entity_type = str(operation.get("entity_type") or "").strip()
        if kind not in SUPPORTED_OPERATION_KINDS:
            return False
        if kind in {"import_analysis_artifact", "attach_content_source", "reindex_marketing_rag_content"}:
            return True
        if entity_type == "customer_facing_summary":
            return kind in {"create", "replace", "update"}
        canonical = _canonical_mutation_entity_type(entity_type)
        return canonical in {
            "job_story",
            "value_proposition",
            "swot_analysis",
            "competitor",
            "segment",
            "campaign",
            "funnel",
            "task",
            "alert",
            "research",
        }

    async def execute_operations(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        operations: list[dict[str, Any]],
        project_context_text: str,
        llm_text: Callable[..., Awaitable[str]],
    ) -> dict[str, Any]:
        operation_trail: list[dict[str, Any]] = []
        applied_entities: list[dict[str, Any]] = []
        destructive_count = 0
        imported_sources = 0
        failed_operations = 0

        for raw_operation in operations:
            operation = dict(raw_operation)
            kind = str(operation.get("kind") or "").strip()
            destructive = bool(operation.get("destructive")) or kind in {"replace", "delete", "archive"}
            if destructive:
                destructive_count += 1
            before_snapshot = await self.fetch_entity_snapshot(
                entity_type=str(operation.get("entity_type") or ""),
                entity_id=str(operation.get("entity_id") or ""),
                project_id=project_id,
            )
            result = await self._execute_operation(
                project_id=project_id,
                user_id=user_id,
                operation=operation,
                project_context_text=project_context_text,
                llm_text=llm_text,
            )
            if kind == "import_analysis_artifact" and result.get("status") == "completed":
                imported_sources += 1
            result_status = str(result.get("status") or "completed").strip() or "completed"
            if result_status not in {"completed", "applied"}:
                failed_operations += 1
            after_snapshot: dict[str, Any] | None
            mutated_ids = [str(item) for item in list(result.get("mutated_entity_ids") or []) if str(item).strip()]
            if len(mutated_ids) == 1 and str(operation.get("entity_type") or ""):
                after_snapshot = await self.fetch_entity_snapshot(
                    entity_type=str(operation.get("entity_type") or ""),
                    entity_id=mutated_ids[0],
                    project_id=project_id,
                )
            else:
                applied = [dict(item) for item in list(result.get("applied_entities") or [])]
                after_snapshot = {"entities": applied} if applied else {}
            applied_entities.extend(list(result.get("applied_entities") or []))
            operation_trail.append(
                {
                    **operation,
                    "destructive": destructive,
                    "before_snapshot": before_snapshot or {},
                    "after_snapshot": after_snapshot or {},
                    "result": {
                        "status": result_status,
                        "message": result.get("message"),
                        "mutated_entity_ids": mutated_ids,
                    },
                    "mutated_entity_ids": mutated_ids,
                }
            )

        return {
            "operation_trail": operation_trail,
            "applied_entities": applied_entities,
            "metrics_after": {
                "applied_count": len(applied_entities),
                "operations_count": len(operation_trail),
                "operations_failed": failed_operations,
                "destructive_count": destructive_count,
                "imported_sources_count": imported_sources,
            },
        }

    async def fetch_entity_snapshot(
        self,
        *,
        entity_type: str,
        entity_id: str,
        project_id: UUID,
    ) -> dict[str, Any] | None:
        if not entity_id:
            return None
        entity_type = _canonical_mutation_entity_type(entity_type)
        entity_uuid = UUID(entity_id)
        if entity_type == "job_story":
            row = await _fetch_job_story(self._db_pool, entity_uuid)
            return normalize_job_story(row) if row is not None else None
        if entity_type == "value_proposition":
            row = await _fetch_value_proposition(self._db_pool, entity_uuid)
            return normalize_value_proposition(row) if row is not None else None
        if entity_type == "swot_analysis":
            row = await _fetch_swot(self._db_pool, entity_uuid)
            if row is None:
                return None
            factors = await _fetch_swot_factors(self._db_pool, entity_uuid)
            return normalize_swot_analysis(row, factors)
        if entity_type == "competitor":
            row = await _fetch_competitor(self._db_pool, entity_uuid)
            return normalize_competitor(row) if row is not None else None
        if entity_type == "segment":
            row = await _fetch_segment(self._db_pool, entity_uuid)
            return normalize_segment(row) if row is not None else None
        if entity_type == "campaign":
            row = await _fetch_campaign(self._db_pool, entity_uuid)
            return normalize_campaign(row) if row is not None else None
        if entity_type == "funnel":
            row = await _fetch_funnel(self._db_pool, entity_uuid)
            if row is None:
                return None
            stages = await _fetch_funnel_stages(self._db_pool, entity_uuid)
            return normalize_funnel(row, stages)
        if entity_type == "task":
            row = await _fetch_task(self._db_pool, entity_uuid)
            return normalize_task(row) if row is not None else None
        if entity_type == "alert":
            row = await _fetch_alert(self._db_pool, entity_uuid)
            return normalize_alert(row) if row is not None else None
        if entity_type == "research":
            row = await _fetch_research(self._db_pool, entity_uuid)
            return normalize_research(row) if row is not None else None
        if entity_type == "customer_facing_summary":
            async with self._db_pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT project_id, payload, updated_at
                    FROM marketing_customer_facing_summary
                    WHERE project_id = $1
                    """,
                    project_id,
                )
            if row is None:
                return None
            payload = _json_dict(row.get("payload"))
            return {
                "id": str(project_id),
                "project_id": str(project_id),
                "title": _first_nonempty(payload.get("headline"), "Сводка для заказчика"),
                "status": "active",
                "payload": payload,
                "updated_at": row.get("updated_at").isoformat() if row.get("updated_at") else None,
            }
        return None

    async def _build_deterministic_funnel_update_payload(self, *, project_id: UUID, funnel_id: str) -> dict[str, Any]:
        snapshot = await self.fetch_entity_snapshot(
            entity_type="funnel",
            entity_id=funnel_id,
            project_id=project_id,
        )
        if not snapshot:
            return {}
        existing_stages = [dict(item) for item in list(snapshot.get("stages") or []) if isinstance(item, dict)]
        if len(existing_stages) >= 3:
            return {}
        existing_by_name = {
            str(item.get("stage_name") or "").strip().casefold(): item
            for item in existing_stages
            if str(item.get("stage_name") or "").strip()
        }
        stages: list[dict[str, Any]] = []
        for order, name in enumerate(_FUNNEL_UPDATE_FALLBACK_STAGES):
            current = existing_by_name.get(name.casefold()) or {}
            stages.append(
                {
                    "stage_name": name,
                    "stage_order": order,
                    "visitors": _safe_nonnegative_int(current.get("visitors")),
                    "conversions": _safe_nonnegative_int(current.get("conversions")),
                }
            )
        return {
            "name": _first_nonempty(snapshot.get("name"), "Marketing funnel"),
            "status": _first_nonempty(snapshot.get("status"), "draft"),
            "primary_goal": _first_nonempty(
                snapshot.get("primary_goal"),
                "Собрать полную маркетинговую воронку от awareness до сделки.",
            ),
            "stages": stages,
        }

    async def _execute_operation(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        operation: dict[str, Any],
        project_context_text: str,
        llm_text: Callable[..., Awaitable[str]],
    ) -> dict[str, Any]:
        kind = str(operation.get("kind") or "").strip()
        entity_type = _canonical_mutation_entity_type(str(operation.get("entity_type") or "").strip())
        payload = _json_dict(operation.get("payload"))
        replacement_payload = _json_dict(operation.get("replacement_payload"))
        target_section = str(operation.get("target_section") or "").strip()
        reason = _first_nonempty(operation.get("reason"), operation.get("expected_effect"))

        if kind == "attach_content_source":
            content_id = _first_nonempty(operation.get("entity_id"), payload.get("content_id"))
            if not content_id:
                raise ValueError("attach_content_source requires content_id")
            await patch_marketing_rag_source_inclusion(
                self._db_pool,
                project_id=project_id,
                content_id=UUID(content_id),
                user_id=user_id,
                marketing_rag_included=bool(payload.get("included", True)),
            )
            return {
                "status": "completed",
                "message": "RAG source inclusion updated",
                "mutated_entity_ids": [content_id],
                "applied_entities": [
                    {
                        "entity_type": "content_source",
                        "entity_id": content_id,
                        "title": _first_nonempty(operation.get("title"), payload.get("title"), "Источник RAG"),
                    }
                ],
            }

        if kind == "reindex_marketing_rag_content":
            content_id = _first_nonempty(operation.get("entity_id"), payload.get("content_id"))
            if not content_id:
                raise ValueError("reindex_marketing_rag_content requires content_id")
            async with self._db_pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT project_id, deleted_at, marketing_rag_included
                    FROM unified_content
                    WHERE id = $1
                    """,
                    UUID(content_id),
                )
            if row is None or row.get("deleted_at") is not None:
                return {
                    "status": "failed",
                    "message": "Документ не найден или удалён",
                    "mutated_entity_ids": [],
                    "applied_entities": [],
                }
            if UUID(str(row["project_id"])) != project_id:
                return {
                    "status": "failed",
                    "message": "Документ не принадлежит проекту",
                    "mutated_entity_ids": [],
                    "applied_entities": [],
                }
            if row.get("marketing_rag_included") is not True:
                return {
                    "status": "failed",
                    "message": "Документ не включён в маркетинговый RAG",
                    "mutated_entity_ids": [],
                    "applied_entities": [],
                }
            ok = await index_unified_content_marketing_rag(self._db_pool, UUID(content_id))
            return {
                "status": "completed" if ok else "failed",
                "message": "Переиндексация RAG выполнена" if ok else "Переиндексация пропущена или не удалась",
                "mutated_entity_ids": [content_id] if ok else [],
                "applied_entities": [
                    {
                        "entity_type": "content_source",
                        "entity_id": content_id,
                        "title": _first_nonempty(operation.get("title"), "Документ RAG"),
                    }
                ]
                if ok
                else [],
            }

        if kind == "import_analysis_artifact":
            source_ref = _json_dict(operation.get("source_ref"))
            content_id = _first_nonempty(source_ref.get("content_id"), payload.get("content_id"))
            if not content_id:
                ref_type = str(source_ref.get("type") or "").strip()
                ref_id = str(source_ref.get("id") or "").strip()
                if ref_type == "imc_run" and ref_id:
                    msg = (
                        f"Импорт артефакта ИМК в RAG проекта не выполнен: прогон {ref_id} не дал материализованного "
                        f"content_id (нет строки результата, прогон не в этом проекте, или текст короче "
                        f"{MIN_EXTRACTED_TEXT_CHARS} символов — типично для partial/pending)."
                    )
                elif not source_ref:
                    msg = (
                        "Импорт артефакта: пустой source_ref и нет payload.content_id "
                        "(ожидается source_ref с type=imc_run и id, либо готовый content_id в payload)."
                    )
                else:
                    msg = (
                        "Импорт артефакта: после материализации source_ref нет content_id "
                        "(проверьте тип источника и поля id/content_id)."
                    )
                return {
                    "status": "failed",
                    "message": msg,
                    "mutated_entity_ids": [],
                    "applied_entities": [],
                }
            return {
                "status": "completed",
                "message": "IMC artifact imported into project content",
                "mutated_entity_ids": [content_id],
                "applied_entities": [
                    {
                        "entity_type": "content_source",
                        "entity_id": content_id,
                        "title": _first_nonempty(source_ref.get("title"), operation.get("title"), "IMC artifact"),
                    }
                ],
            }

        if entity_type == "customer_facing_summary":
            return await self._upsert_customer_summary(
                project_id=project_id,
                user_id=user_id,
                payload=replacement_payload or payload,
            )

        if kind in {"create", "replace", "update"} and _is_project_autofill_operation(payload, replacement_payload):
            return await self._execute_autofill_operation(
                project_id=project_id,
                user_id=user_id,
                entity_type=entity_type,
                target_section=target_section,
                source_payload=replacement_payload or payload,
                reason=reason,
                operation_kind=kind,
                replace_entity_id=_first_nonempty(operation.get("entity_id")) if kind in {"replace", "update"} else "",
                project_context_text=project_context_text,
            )

        if kind == "create":
            return await self._create_direct(
                project_id=project_id, user_id=user_id, entity_type=entity_type, payload=payload
            )
        if kind == "update":
            return await self._update_direct(
                project_id=project_id,
                user_id=user_id,
                entity_type=entity_type,
                entity_id=_first_nonempty(operation.get("entity_id")),
                payload=payload,
            )
        if kind == "replace":
            updated = await self._update_direct(
                project_id=project_id,
                user_id=user_id,
                entity_type=entity_type,
                entity_id=_first_nonempty(operation.get("entity_id")),
                payload=replacement_payload or payload,
            )
            updated["message"] = "Entity replaced"
            return updated
        if kind == "delete":
            return await self._delete_direct(
                project_id=project_id,
                user_id=user_id,
                entity_type=entity_type,
                entity_id=_first_nonempty(operation.get("entity_id")),
            )
        if kind == "archive":
            return await self._status_transition(
                project_id=project_id,
                user_id=user_id,
                entity_type=entity_type,
                entity_id=_first_nonempty(operation.get("entity_id")),
                status_value=_infer_archive_status(entity_type, payload),
            )
        if kind == "status_transition":
            return await self._status_transition(
                project_id=project_id,
                user_id=user_id,
                entity_type=entity_type,
                entity_id=_first_nonempty(operation.get("entity_id")),
                status_value=_first_nonempty(payload.get("status"), operation.get("status")),
            )
        raise ValueError(f"Unsupported AMKA operation kind: {kind}")

    async def _execute_autofill_operation(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        entity_type: str,
        target_section: str,
        source_payload: dict[str, Any],
        reason: str,
        operation_kind: str,
        replace_entity_id: str,
        project_context_text: str,
    ) -> dict[str, Any]:
        target = ENTITY_AUTOFILL_TARGETS.get(entity_type) or AutofillTarget(
            str(source_payload.get("autofill_target") or target_section)
        )
        ctx_full = project_context_text.strip()
        ctx_variants = [
            project_context_text,
            _truncate_project_context_for_autofill_retry(ctx_full, max_chars=_AMKA_AUTOFILL_CONTEXT_TRIM),
            _truncate_project_context_for_autofill_retry(ctx_full, max_chars=_AMKA_AUTOFILL_CONTEXT_TRIM_AGGRESSIVE),
        ]
        temps = [0.2, 0.12, 0.08]
        result_payload: dict[str, Any] | None = None
        last_exc: HTTPException | None = None
        for attempt in range(_AMKA_AUTOFILL_MAX_TRIES):
            ctx_text = ctx_variants[min(attempt, len(ctx_variants) - 1)]
            temp = temps[min(attempt, len(temps) - 1)]
            prompt = _build_prompt_project_only(
                target_section=target,
                project_context_text=ctx_text,
                user_instruction=reason,
            )
            if operation_kind == "update" and target == AutofillTarget.FUNNELS and replace_entity_id:
                prompt = (
                    f"{prompt}\n\n"
                    "Контракт AMKA для обновления существующей воронки: верни один JSON-объект без markdown. "
                    "items должен содержать ровно одну воронку: "
                    '{"items":[{"name":"<текущее или уточнённое название>","status":"draft|active|archived",'
                    '"primary_goal":"<цель>","stages":[{"stage_name":"Awareness","stage_order":0,'
                    '"visitors":0,"conversions":0},{"stage_name":"Consideration","stage_order":1,'
                    '"visitors":0,"conversions":0}]}]}. '
                    "Не возвращай список этапов на верхнем уровне; stages обязателен внутри элемента items[0]."
                )
            if attempt > 0:
                prompt = (
                    f"{prompt}\n\n"
                    "Повтор генерации: ответь одним JSON-объектом (без ``` и без текста до/после). "
                    "Ключи: summary (строка или пустая), warnings (массив строк), items (массив по контракту раздела). "
                    "Без комментариев // и /* */ внутри JSON; в items только поля из контракта раздела.\n"
                )
                if target == AutofillTarget.FUNNELS:
                    prompt = (
                        f"{prompt}\n"
                        "Для раздела funnels обязательно верни items: [{name, status, primary_goal, stages}], "
                        "где stages — массив объектов со stage_name, visitors, conversions, stage_order. "
                        "Если обновляешь существующую воронку, сохрани её название или восстанови name из цели.\n"
                    )
            raw_output = await amka_llm_json_raw(prompt=prompt, max_tokens=4200, temperature=temp)
            runtime_warnings: list[str] = []
            if attempt > 0:
                runtime_warnings.append(
                    f"AMKA: повтор autofill {attempt + 1}/{_AMKA_AUTOFILL_MAX_TRIES} (укороченный контекст / температура {temp})."
                )
            try:
                result_payload, _excerpt, _metadata = _build_preview_result_payload(
                    target_section=target,
                    content_item=_synthetic_project_source_content_item(),
                    raw_output=raw_output,
                    runtime_warnings=runtime_warnings,
                    generation_type_key="document_structured_extract",
                    log_context={
                        "source": "amka_project_autofill",
                        "project_id": str(project_id),
                        "target_section": target.value,
                        "attempt": attempt + 1,
                        "context_chars": len(ctx_text),
                        "temperature": temp,
                    },
                )
                result_payload = _sanitize_generated_preview_payload(result_payload)
                break
            except HTTPException as exc:
                last_exc = exc
                detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
                final_attempt = attempt + 1 >= _AMKA_AUTOFILL_MAX_TRIES
                outcome_status = _autofill_preview_error_status(detail, final_attempt=final_attempt)
                if final_attempt or not _autofill_error_is_retryable(detail):
                    if (
                        final_attempt
                        and operation_kind == "update"
                        and target == AutofillTarget.FUNNELS
                        and replace_entity_id
                    ):
                        fallback_payload = await self._build_deterministic_funnel_update_payload(
                            project_id=project_id,
                            funnel_id=replace_entity_id,
                        )
                        if fallback_payload:
                            updated = await self._update_direct(
                                project_id=project_id,
                                user_id=user_id,
                                entity_type=entity_type,
                                entity_id=replace_entity_id,
                                payload=fallback_payload,
                            )
                            return {
                                **updated,
                                "status": "applied",
                                "message": "Funnel preview failed; deterministic AMKA funnel skeleton applied",
                            }
                    message = detail if isinstance(detail, str) else str(detail)
                    return {
                        "status": outcome_status,
                        "message": message or "Autofill preview rejected",
                        "mutated_entity_ids": [],
                        "applied_entities": [],
                    }
                logger.warning(
                    "amka.autofill_preview_retry project_id=%s target=%s attempt=%s chars=%s status=%s detail=%s",
                    project_id,
                    target.value,
                    attempt + 1,
                    len(ctx_text),
                    outcome_status,
                    detail[:280],
                )
        if result_payload is None:
            detail = last_exc.detail if last_exc and isinstance(last_exc.detail, str) else str(last_exc or "unknown")
            return {
                "status": "failed",
                "message": detail,
                "mutated_entity_ids": [],
                "applied_entities": [],
            }
        if target == AutofillTarget.SEGMENTS and replace_entity_id:
            await _merge_segment_autofill_preview_links(
                self._db_pool,
                project_id=project_id,
                replace_entity_id=replace_entity_id,
                result_payload=result_payload,
            )
        if operation_kind == "update" and target == AutofillTarget.FUNNELS and replace_entity_id:
            preview_items = [
                dict(item) for item in list(result_payload.get("preview_items") or []) if isinstance(item, dict)
            ]
            payload = _json_dict(preview_items[0].get("payload")) if preview_items else {}
            if not payload:
                fallback_payload = await self._build_deterministic_funnel_update_payload(
                    project_id=project_id,
                    funnel_id=replace_entity_id,
                )
                if fallback_payload:
                    updated = await self._update_direct(
                        project_id=project_id,
                        user_id=user_id,
                        entity_type=entity_type,
                        entity_id=replace_entity_id,
                        payload=fallback_payload,
                    )
                    return {
                        **updated,
                        "status": "applied",
                        "message": "Funnel preview was empty; deterministic AMKA funnel skeleton applied",
                    }
                return {
                    "status": "no_preview",
                    "message": "Funnel preview did not contain a payload for update",
                    "mutated_entity_ids": [],
                    "applied_entities": [],
                }
            updated = await self._update_direct(
                project_id=project_id,
                user_id=user_id,
                entity_type=entity_type,
                entity_id=replace_entity_id,
                payload=payload,
            )
            return {
                **updated,
                "status": "applied",
                "message": "Autofill operation updated existing funnel",
            }
        applied = await apply_project_autofill_preview_to_entities(
            self._db_pool,
            project_id=project_id,
            user_id=user_id,
            target_section=target,
            result_payload=result_payload,
            user_instruction=reason,
        )
        mutated_ids = [
            _first_nonempty(item.get("entity_id"), item.get("id")) for item in applied if isinstance(item, dict)
        ]
        mutated_ids = [item for item in mutated_ids if item]
        if operation_kind == "replace" and replace_entity_id:
            await self._delete_direct(
                project_id=project_id,
                user_id=user_id,
                entity_type=entity_type,
                entity_id=replace_entity_id,
            )
        return {
            "status": "completed",
            "message": "Autofill operation applied",
            "mutated_entity_ids": mutated_ids,
            "applied_entities": applied,
        }

    async def _create_direct(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        entity_type: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        if entity_type == "job_story":
            item = await create_job_story(
                JobStoryCreateRequest(project_id=project_id, **payload),
                db_pool=self._db_pool,
                user_id=user_id,
            )
            return self._mutation_result(entity_type, item)
        if entity_type == "value_proposition":
            item = await create_value_proposition(
                ValuePropositionCreateRequest(project_id=project_id, **payload),
                db_pool=self._db_pool,
                user_id=user_id,
            )
            return self._mutation_result(entity_type, item)
        if entity_type == "swot_analysis":
            project = await get_accessible_project(
                self._db_pool, project_id, user_id, for_mutation=True, required_mc_module="amka"
            )
            factors_by_type = {
                "strength": [
                    {"factor_text": text, "impact_level": "medium", "priority_score": 0}
                    for text in _json_list(payload.get("strengths"))
                ],
                "weakness": [
                    {"factor_text": text, "impact_level": "medium", "priority_score": 0}
                    for text in _json_list(payload.get("weaknesses"))
                ],
                "opportunity": [
                    {"factor_text": text, "impact_level": "medium", "priority_score": 0}
                    for text in _json_list(payload.get("opportunities"))
                ],
                "threat": [
                    {"factor_text": text, "impact_level": "medium", "priority_score": 0}
                    for text in _json_list(payload.get("threats"))
                ],
            }
            item = await _create_swot_analysis(
                self._db_pool,
                project_id=project_id,
                company_id=project["company_id"],
                user_id=user_id,
                title=_first_nonempty(payload.get("title"), "SWOT-анализ"),
                description=_first_nonempty(payload.get("description")) or None,
                executive_summary=_first_nonempty(payload.get("executive_summary")) or None,
                company_name=_first_nonempty(payload.get("company_name")) or None,
                industry=_first_nonempty(payload.get("industry")) or None,
                factors_by_type=factors_by_type,
            )
            return self._mutation_result(entity_type, item)
        if entity_type == "competitor":
            item = await create_competitor(
                CompetitorCreateRequest(
                    project_id=project_id,
                    **_normalize_competitor_mutation_payload(payload, require_name=True),
                ),
                db_pool=self._db_pool,
                user_id=user_id,
            )
            return self._mutation_result(entity_type, item)
        if entity_type == "segment":
            segment_payload = await _resolve_segment_mutation_payload(
                self._db_pool,
                project_id=project_id,
                payload=payload,
                for_create=True,
            )
            item = await create_segment(
                SegmentCreateRequest(project_id=project_id, **segment_payload),
                db_pool=self._db_pool,
                user_id=user_id,
            )
            return self._mutation_result(entity_type, item)
        if entity_type == "campaign":
            item = await create_campaign(
                CampaignCreateRequest(project_id=project_id, **payload),
                db_pool=self._db_pool,
                user_id=user_id,
            )
            return self._mutation_result(entity_type, item)
        if entity_type == "funnel":
            stages = [FunnelStageInput(**stage) for stage in _json_list(payload.get("stages"))]
            item = await create_funnel(
                FunnelCreateRequest(
                    project_id=project_id, stages=stages, **{k: v for k, v in payload.items() if k != "stages"}
                ),
                db_pool=self._db_pool,
                user_id=user_id,
            )
            return self._mutation_result(entity_type, item)
        if entity_type == "task":
            item = await create_task(
                TaskCreateRequest(project_id=project_id, **payload),
                db_pool=self._db_pool,
                user_id=user_id,
            )
            return self._mutation_result(entity_type, item)
        if entity_type == "alert":
            item = await create_alert(
                AlertCreateRequest(project_id=project_id, **payload),
                db_pool=self._db_pool,
                user_id=user_id,
            )
            return self._mutation_result(entity_type, item)
        if entity_type == "research":
            raw = dict(payload)
            rq = str(
                raw.get("research_query")
                or raw.get("query")
                or raw.get("evidence_query")
                or raw.get("question")
                or raw.get("hypothesis")
                or ""
            ).strip()
            if len(rq) < 3:
                rq = str(raw.get("description") or raw.get("summary") or "").strip()
            if len(rq) < 3:
                rq = "Проработать доказательную базу по текущему контексту проекта."
            title = str(raw.get("title") or raw.get("headline") or "Исследование AMKA").strip()
            if len(title) < 3:
                title = "Исследование AMKA"
            create_payload: dict[str, Any] = {
                "project_id": project_id,
                "title": title[:500],
                "research_query": rq,
            }
            for key in (
                "research_type",
                "description",
                "priority",
                "status",
                "result_summary",
                "result_content_id",
            ):
                if key in raw and raw[key] is not None:
                    create_payload[key] = raw[key]
            goals = _json_list(raw.get("goals"))
            if goals:
                create_payload["goals"] = goals
            item = await create_research(
                ResearchCreateRequest.model_validate(create_payload),
                db_pool=self._db_pool,
                user_id=user_id,
            )
            return self._mutation_result(entity_type, item)
        raise ValueError(f"Unsupported direct create for {entity_type}")

    async def _update_direct(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        entity_type: str,
        entity_id: str,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        entity_uuid = UUID(entity_id)
        if entity_type == "job_story":
            item = await update_job_story(
                entity_uuid,
                JobStoryUpdateRequest(**payload),
                db_pool=self._db_pool,
                user_id=user_id,
            )
            return self._mutation_result(entity_type, item)
        if entity_type == "value_proposition":
            item = await update_value_proposition(
                entity_uuid,
                ValuePropositionUpdateRequest(**payload),
                db_pool=self._db_pool,
                user_id=user_id,
            )
            return self._mutation_result(entity_type, item)
        if entity_type == "swot_analysis":
            item = await self._update_swot_summary(entity_uuid, payload=payload, user_id=user_id)
            return self._mutation_result(entity_type, item)
        if entity_type == "competitor":
            item = await update_competitor(
                entity_uuid,
                CompetitorUpdateRequest(**_normalize_competitor_mutation_payload(payload, require_name=False)),
                db_pool=self._db_pool,
                user_id=user_id,
            )
            return self._mutation_result(entity_type, item)
        if entity_type == "segment":
            segment_payload = await _resolve_segment_mutation_payload(
                self._db_pool,
                project_id=project_id,
                payload=payload,
                for_create=False,
            )
            item = await update_segment(
                entity_uuid,
                SegmentUpdateRequest(**segment_payload),
                db_pool=self._db_pool,
                user_id=user_id,
            )
            return self._mutation_result(entity_type, item)
        if entity_type == "campaign":
            item = await update_campaign(
                entity_uuid,
                CampaignUpdateRequest(**payload),
                db_pool=self._db_pool,
                user_id=user_id,
            )
            return self._mutation_result(entity_type, item)
        if entity_type == "funnel":
            payload_data = dict(payload)
            if "stages" in payload_data:
                payload_data["stages"] = [FunnelStageInput(**stage) for stage in _json_list(payload_data.get("stages"))]
            item = await update_funnel(
                entity_uuid,
                FunnelUpdateRequest(**payload_data),
                db_pool=self._db_pool,
                user_id=user_id,
            )
            return self._mutation_result(entity_type, item)
        if entity_type == "task":
            item = await update_task(
                entity_uuid,
                TaskUpdateRequest(**payload),
                db_pool=self._db_pool,
                user_id=user_id,
            )
            return self._mutation_result(entity_type, item)
        if entity_type == "alert":
            item = await update_alert(
                entity_uuid,
                AlertUpdateRequest(**payload),
                db_pool=self._db_pool,
                user_id=user_id,
            )
            return self._mutation_result(entity_type, item)
        if entity_type == "research":
            allowed = set(ResearchUpdateRequest.model_fields)
            filtered = {k: v for k, v in payload.items() if k in allowed}
            item = await update_research(
                entity_uuid,
                ResearchUpdateRequest.model_validate(filtered),
                db_pool=self._db_pool,
                user_id=user_id,
            )
            return self._mutation_result(entity_type, item)
        raise ValueError(f"Unsupported direct update for {entity_type}")

    async def _delete_direct(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        entity_type: str,
        entity_id: str,
    ) -> dict[str, Any]:
        entity_uuid = UUID(entity_id)
        if entity_type == "job_story":
            await delete_job_story(entity_uuid, db_pool=self._db_pool, user_id=user_id)
        elif entity_type == "value_proposition":
            await delete_value_proposition(entity_uuid, db_pool=self._db_pool, user_id=user_id)
        elif entity_type == "swot_analysis":
            await delete_swot_analysis(entity_uuid, db_pool=self._db_pool, user_id=user_id)
        elif entity_type == "competitor":
            await delete_competitor(entity_uuid, db_pool=self._db_pool, user_id=user_id)
        elif entity_type == "segment":
            await delete_segment(entity_uuid, db_pool=self._db_pool, user_id=user_id)
        elif entity_type == "campaign":
            await delete_campaign(entity_uuid, db_pool=self._db_pool, user_id=user_id)
        elif entity_type == "funnel":
            await delete_funnel(entity_uuid, db_pool=self._db_pool, user_id=user_id)
        elif entity_type == "task":
            await delete_task(entity_uuid, db_pool=self._db_pool, user_id=user_id)
        elif entity_type == "alert":
            await delete_alert(entity_uuid, db_pool=self._db_pool, user_id=user_id)
        elif entity_type == "research":
            await delete_research(entity_uuid, db_pool=self._db_pool, user_id=user_id)
        else:
            raise ValueError(f"Unsupported delete for {entity_type}")
        return {
            "status": "completed",
            "message": "Entity deleted",
            "mutated_entity_ids": [entity_id],
            "applied_entities": [{"entity_type": entity_type, "entity_id": entity_id, "title": "Удалено"}],
        }

    async def _status_transition(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        entity_type: str,
        entity_id: str,
        status_value: str,
    ) -> dict[str, Any]:
        if not status_value:
            raise ValueError("status_transition requires status")
        return await self._update_direct(
            project_id=project_id,
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            payload={"status": status_value},
        )

    async def _upsert_customer_summary(
        self,
        *,
        project_id: UUID,
        user_id: UUID,
        payload: dict[str, Any],
    ) -> dict[str, Any]:
        summary_payload = {
            "headline": _first_nonempty(payload.get("headline"), "Сводка проекта"),
            "intro": _first_nonempty(payload.get("intro"), "Сводка подготовлена автоматически по материалам проекта."),
            "bullets": [str(item).strip() for item in _json_list(payload.get("bullets")) if str(item).strip()][:8],
            "metrics": [
                {
                    "label": _trim_text(item.get("label"), 120),
                    "value": _trim_text(item.get("value"), 240),
                }
                for item in _json_list(payload.get("metrics"))
                if isinstance(item, dict)
            ][:6],
        }
        async with self._db_pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO marketing_customer_facing_summary (
                    project_id,
                    payload,
                    updated_by_user_id,
                    updated_at
                ) VALUES (
                    $1,
                    $2::jsonb,
                    $3,
                    NOW()
                )
                ON CONFLICT (project_id) DO UPDATE SET
                    payload = EXCLUDED.payload,
                    updated_by_user_id = EXCLUDED.updated_by_user_id,
                    updated_at = NOW()
                """,
                project_id,
                json.dumps(summary_payload),
                user_id,
            )
        return {
            "status": "completed",
            "message": "Customer summary updated",
            "mutated_entity_ids": [str(project_id)],
            "applied_entities": [
                {
                    "entity_type": "customer_facing_summary",
                    "entity_id": str(project_id),
                    "title": summary_payload["headline"],
                }
            ],
        }

    async def _update_swot_summary(
        self,
        analysis_id: UUID,
        *,
        payload: dict[str, Any],
        user_id: UUID,
    ) -> dict[str, Any]:
        existing = await _fetch_swot(self._db_pool, analysis_id)
        if existing is None:
            raise ValueError("SWOT analysis not found")
        updates = SWOTUpdateRequest(**payload).model_dump(exclude_unset=True)
        if not updates:
            row = await self.fetch_entity_snapshot(
                entity_type="swot_analysis",
                entity_id=str(analysis_id),
                project_id=UUID(str(existing["project_id"])),
            )
            return row or {}
        set_parts: list[str] = []
        params: list[Any] = []
        index = 1
        for field in ("title", "description", "executive_summary", "company_name", "industry"):
            if field in updates:
                set_parts.append(f"{field} = ${index}")
                params.append(updates[field])
                index += 1
        set_parts.append("updated_at = NOW()")
        params.append(analysis_id)
        async with self._db_pool.acquire() as conn, conn.transaction():
            row = await conn.fetchrow(
                f"""
                UPDATE swot_analyses
                SET {", ".join(set_parts)}
                WHERE id = ${index}
                  AND deleted_at IS NULL
                RETURNING *
                """,  # noqa: S608
                *params,
            )
            if row is None:
                raise ValueError("SWOT update failed")
        factors = await _fetch_swot_factors(self._db_pool, analysis_id)
        return normalize_swot_analysis(row, factors)

    def _mutation_result(self, entity_type: str, item: Any) -> dict[str, Any]:
        snapshot = _as_mutation_snapshot(item)
        return {
            "status": "completed",
            "message": "Mutation applied",
            "mutated_entity_ids": [str(snapshot.get("id") or "")],
            "applied_entities": [_entity_ref(entity_type, snapshot)],
        }

    def _to_entity_brief(self, entity_type: str, snapshot: dict[str, Any]) -> dict[str, Any]:
        title = _first_nonempty(snapshot.get("title"), snapshot.get("name"), snapshot.get("headline"), entity_type)
        summary = self._build_summary(entity_type, snapshot)
        return {
            "entity_type": entity_type,
            "entity_id": str(snapshot.get("id") or ""),
            "title": title,
            "status": snapshot.get("status"),
            "summary": summary,
            "snapshot": snapshot,
        }

    def _build_summary(self, entity_type: str, snapshot: dict[str, Any]) -> str:
        if entity_type == "job_story":
            return _trim_text(snapshot.get("statement") or snapshot.get("situation"), 240)
        if entity_type == "value_proposition":
            return _trim_text(snapshot.get("value_statement") or snapshot.get("headline"), 240)
        if entity_type == "swot_analysis":
            return _trim_text(
                f"strengths={snapshot.get('strengths_count', 0)}, weaknesses={snapshot.get('weaknesses_count', 0)}, opportunities={snapshot.get('opportunities_count', 0)}, threats={snapshot.get('threats_count', 0)}",
                240,
            )
        if entity_type == "competitor":
            return _trim_text(snapshot.get("description") or snapshot.get("market_position"), 240)
        if entity_type == "segment":
            return _trim_text(snapshot.get("description") or snapshot.get("segment_type"), 240)
        if entity_type == "campaign":
            return _trim_text(snapshot.get("objective") or snapshot.get("hypothesis"), 240)
        if entity_type == "funnel":
            return _trim_text(snapshot.get("primary_goal") or f"stages={len(_json_list(snapshot.get('stages')))}", 240)
        if entity_type == "task":
            return _trim_text(snapshot.get("description") or snapshot.get("priority"), 240)
        if entity_type == "alert":
            return _trim_text(snapshot.get("description") or snapshot.get("severity"), 240)
        if entity_type == "research":
            return _trim_text(
                snapshot.get("research_query") or snapshot.get("description") or snapshot.get("title"), 240
            )
        if entity_type == "customer_facing_summary":
            return _trim_text(_json_dict(snapshot.get("payload")).get("intro"), 240)
        return _trim_text(snapshot, 240)
