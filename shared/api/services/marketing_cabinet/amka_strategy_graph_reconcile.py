# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Reconcile marketing strategy link arrays (JTBD, value propositions, segments, campaigns, and evidence) for overview metrics.
# Invariants:
# - Weak fuzzy matches are returned as candidates for review, not written automatically.
# - Auto-write only applies single/high-confidence links or explicit LLM-confirmed mappings.
# Related:
# - documentation/worklog/session-summaries/2026-05-28-0124-eliteew-api-worker-audit.md
# ---

"""Reconcile marketing strategy link arrays (JTBD ↔ VP ↔ segments ↔ campaigns) for overview metrics."""

from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable
from difflib import SequenceMatcher
from typing import Any
from uuid import UUID

import asyncpg  # type: ignore[import-not-found]

from api.routers.marketing_cabinet.campaigns import CampaignUpdateRequest, update_campaign
from api.routers.marketing_cabinet.common import get_accessible_project
from api.routers.marketing_cabinet.segments import SegmentUpdateRequest, update_segment
from api.routers.marketing_cabinet.value_proposition import (
    ValuePropositionUpdateRequest,
    update_value_proposition,
)

logger = logging.getLogger(__name__)

_AUTO_FUZZY_THRESHOLD = 0.62
_REVIEW_FUZZY_THRESHOLD = 0.42
_FUZZY_STOPWORDS = {
    "and",
    "для",
    "или",
    "как",
    "the",
    "with",
    "без",
    "что",
    "это",
    "они",
    "при",
    "who",
    "через",
    "которые",
    "нужен",
    "нужна",
}


def _norm_text(value: str) -> str:
    return " ".join(value.casefold().split())


def _trim_vp_text(text: str, *, max_len: int = 900) -> str:
    t = " ".join(text.split())
    if len(t) <= max_len:
        return t
    return t[: max_len - 1] + "…"


def _fuzzy_tokens(value: str) -> set[str]:
    return {
        token.strip(".,:;!?()[]{}\"'«»").casefold()
        for token in value.split()
        if len(token.strip(".,:;!?()[]{}\"'«»")) >= 4
        and token.strip(".,:;!?()[]{}\"'«»").casefold() not in _FUZZY_STOPWORDS
    }


def _content_choice_text(title: str, evidence_text: str) -> str:
    title_clean = " ".join(title.split())
    evidence_clean = " ".join(evidence_text.split())
    if not evidence_clean:
        return title_clean
    return f"{title_clean}. {_trim_vp_text(evidence_clean, max_len=1800)}"


def _best_fuzzy_match(
    needle: str,
    choices: list[tuple[UUID, str]],
) -> tuple[UUID | None, float]:
    best_id: UUID | None = None
    best_score = 0.0
    n = _norm_text(needle)
    if not n:
        return None, 0.0
    n_tokens = _fuzzy_tokens(n)
    for cid, title in choices:
        t = _norm_text(title)
        if not t:
            continue
        ratio = SequenceMatcher(None, n, t).ratio()
        if t in n or n in t:
            ratio = max(ratio, 0.58)
        if len(t) >= 4 and t in n:
            ratio = max(ratio, 0.62)
        if n_tokens:
            t_tokens = _fuzzy_tokens(t)
            if t_tokens:
                overlap = len(n_tokens & t_tokens) / max(1, min(len(n_tokens), len(t_tokens)))
                if overlap >= 0.8 and len(n_tokens) >= 3:
                    ratio = max(ratio, 0.64)
                elif overlap >= 0.45:
                    ratio = max(ratio, 0.48)
        if ratio > best_score:
            best_score = ratio
            best_id = cid
    return best_id, best_score


def _append_reconcile_detail(
    details: list[str],
    structured_details: list[dict[str, Any]],
    *,
    source_entity_type: str,
    source_entity_id: UUID,
    target_entity_type: str,
    target_entity_id: UUID | None,
    link_kind: str,
    action: str,
    reason: str,
    confidence: float | None = None,
) -> None:
    score_text = f" score={confidence:.2f}" if confidence is not None else ""
    target_text = str(target_entity_id) if target_entity_id else "—"
    details.append(f"{source_entity_type} {source_entity_id}: {action} {link_kind} → {target_text}{score_text}")
    structured_details.append(
        {
            "source_entity_type": source_entity_type,
            "source_entity_id": str(source_entity_id),
            "target_entity_type": target_entity_type,
            "target_entity_id": str(target_entity_id) if target_entity_id else None,
            "link_kind": link_kind,
            "action": action,
            "confidence": confidence,
            "reason": reason,
        }
    )


async def snapshot_value_prop_ids_with_jtbd_links(
    db_pool: asyncpg.Pool,
    project_id: UUID,
) -> frozenset[UUID]:
    async with db_pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id
            FROM value_propositions
            WHERE project_id = $1
              AND deleted_at IS NULL
              AND COALESCE(array_length(addressed_job_ids, 1), 0) > 0
            """,
            project_id,
        )
    return frozenset(r["id"] for r in rows)


async def _llm_assign_value_props_to_jobs(
    llm_json: Callable[..., Awaitable[dict[str, Any]]],
    *,
    orphans: list[dict[str, Any]],
    jobs: list[dict[str, Any]],
) -> dict[str, list[UUID]]:
    if not orphans or not jobs:
        return {}
    prompt = "\n".join(
        [
            "Сопоставь каждое value proposition (VP) с одной или несколькими job stories (JTBD) одного проекта.",
            "Верни строго JSON-объект с ключом assignments — массив объектов:",
            '{"assignments": [{"value_proposition_id": "<uuid>", "job_story_ids": ["<uuid>", ...]}]}',
            "Используй только перечисленные id. Если для VP нет уверенной связи ни с одной job story, не включай этот VP.",
            "",
            "## Job stories",
            json.dumps(jobs, ensure_ascii=False),
            "",
            "## Value propositions без связей",
            json.dumps(orphans, ensure_ascii=False),
        ]
    )
    try:
        raw = await llm_json(prompt=prompt, max_tokens=1600)
    except Exception as exc:
        logger.warning(
            "[amka.reconcile] llm_mapping_failed type=%s msg=%s",
            type(exc).__name__,
            exc,
        )
        return {}
    if not isinstance(raw, dict):
        return {}
    out: dict[str, list[UUID]] = {}
    for item in list(raw.get("assignments") or []):
        if not isinstance(item, dict):
            continue
        vp_id = str(item.get("value_proposition_id") or "").strip()
        raw_jobs = item.get("job_story_ids")
        if not vp_id or not isinstance(raw_jobs, list):
            continue
        uuids: list[UUID] = []
        for j in raw_jobs:
            try:
                uuids.append(UUID(str(j).strip()))
            except (TypeError, ValueError):  # fmt: skip
                continue
        if uuids:
            out[vp_id] = uuids
    return out


async def _llm_confirm_segment_content_link(
    llm_json: Callable[..., Awaitable[dict[str, Any]]],
    *,
    segment: dict[str, Any],
    content: dict[str, Any],
    fuzzy_confidence: float,
) -> bool:
    prompt = "\n".join(
        [
            "Проверь одну candidate-связь между сегментом аудитории и evidence/content source.",
            'Верни строго JSON-объект: {"confirmed": true|false, "reason": "..."}.',
            "confirmed=true только если content реально подтверждает, описывает или исследует этот сегмент. "
            "Не подтверждай связь только из-за общих слов вроде marketing, analysis, report.",
            "",
            "## Segment",
            json.dumps(segment, ensure_ascii=False),
            "",
            "## Content candidate",
            json.dumps(content, ensure_ascii=False),
            "",
            f"## Fuzzy confidence: {fuzzy_confidence:.3f}",
        ]
    )
    try:
        raw = await llm_json(prompt=prompt, max_tokens=700)
    except Exception as exc:
        logger.warning(
            "[amka.reconcile] llm_segment_content_confirm_failed type=%s msg=%s",
            type(exc).__name__,
            exc,
        )
        return False
    if not isinstance(raw, dict):
        return False
    return raw.get("confirmed") is True


async def reconcile_marketing_strategy_graph_for_project(
    db_pool: asyncpg.Pool,
    *,
    project_id: UUID,
    user_id: UUID,
    llm_json: Callable[..., Awaitable[dict[str, Any]]] | None = None,
) -> dict[str, Any]:
    """Fill missing graph links used by overview health (addressed_job_ids, segment/campaign arrays)."""
    await get_accessible_project(db_pool, project_id, user_id, for_mutation=True, required_mc_module="amka")

    details: list[str] = []
    structured_details: list[dict[str, Any]] = []
    vp_updated = 0
    seg_updated = 0
    camp_updated = 0
    segment_evidence_updated = 0
    llm_used = False

    async with db_pool.acquire() as conn:
        job_rows = list(
            await conn.fetch(
                """
                SELECT id, COALESCE(NULLIF(BTRIM(metadata->>'title'), ''), situation) AS title
                FROM job_stories
                WHERE project_id = $1
                  AND deleted_at IS NULL
                ORDER BY created_at ASC
                """,
                project_id,
            )
        )
        jobs: list[tuple[UUID, str]] = [(r["id"], str(r["title"] or "")) for r in job_rows]

        vp_rows = list(
            await conn.fetch(
                """
                SELECT
                    id,
                    COALESCE(headline, subheadline, value_statement, '') AS vp_text
                FROM value_propositions
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND COALESCE(array_length(addressed_job_ids, 1), 0) = 0
                """,
                project_id,
            )
        )

        segment_rows = list(
            await conn.fetch(
                """
                SELECT
                    id,
                    name,
                    COALESCE(description, '') AS description,
                    linked_job_story_ids,
                    linked_content_ids
                FROM marketing_segments
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND (
                    COALESCE(array_length(linked_job_story_ids, 1), 0) = 0
                    OR COALESCE(array_length(linked_content_ids, 1), 0) = 0
                  )
                """,
                project_id,
            )
        )

        all_segment_records = list(
            await conn.fetch(
                """
                SELECT id, name
                FROM marketing_segments
                WHERE project_id = $1
                  AND deleted_at IS NULL
                """,
                project_id,
            )
        )
        all_segment_choices: list[tuple[UUID, str]] = [(r["id"], str(r["name"] or "")) for r in all_segment_records]

        vp_records = list(
            await conn.fetch(
                """
                SELECT id, COALESCE(headline, subheadline, value_statement, '') AS title
                FROM value_propositions
                WHERE project_id = $1
                  AND deleted_at IS NULL
                """,
                project_id,
            )
        )
        all_vp_choices: list[tuple[UUID, str]] = [(r["id"], str(r["title"] or "")) for r in vp_records]

        campaign_rows = list(
            await conn.fetch(
                """
                SELECT id, name
                FROM marketing_campaigns
                WHERE project_id = $1
                  AND deleted_at IS NULL
                """,
                project_id,
            )
        )

        content_rows = list(
            await conn.fetch(
                """
                SELECT
                    id,
                    COALESCE(NULLIF(BTRIM(name), ''), NULLIF(BTRIM(original_filename), ''), NULLIF(BTRIM(description), ''), id::text) AS title,
                    LEFT(
                        COALESCE(NULLIF(BTRIM(description), ''), '') || ' ' ||
                        COALESCE(NULLIF(BTRIM(extracted_text), ''), ''),
                        2400
                    ) AS evidence_text
                FROM unified_content
                WHERE project_id = $1
                  AND deleted_at IS NULL
                  AND COALESCE(marketing_rag_included, TRUE) IS TRUE
                  AND COALESCE(NULLIF(BTRIM(extracted_text), ''), NULLIF(BTRIM(description), ''), NULLIF(BTRIM(name), '')) IS NOT NULL
                ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
                LIMIT 80
                """,
                project_id,
            )
        )

    all_content_choices: list[tuple[UUID, str]] = [
        (
            r["id"],
            _content_choice_text(str(r["title"] or ""), str(r["evidence_text"] or "")),
        )
        for r in content_rows
    ]
    content_choice_text_by_id = {cid: text for cid, text in all_content_choices}
    content_title_by_id = {r["id"]: str(r["title"] or "") for r in content_rows}

    job_ids = [j[0] for j in jobs]

    vp_assignments: dict[UUID, list[UUID]] = {}
    for row in vp_rows:
        vid: UUID = row["id"]
        text = str(row["vp_text"] or "")
        chosen: list[UUID] = []
        if len(jobs) == 1:
            chosen = [jobs[0][0]]
            details.append(f"VP {vid}: единственный JTBD → привязка")
        elif len(jobs) > 1:
            best_id, score = _best_fuzzy_match(text, jobs)
            if best_id and score >= _AUTO_FUZZY_THRESHOLD:
                chosen = [best_id]
                _append_reconcile_detail(
                    details,
                    structured_details,
                    source_entity_type="value_proposition",
                    source_entity_id=vid,
                    target_entity_type="job_story",
                    target_entity_id=best_id,
                    link_kind="addresses_jtbd",
                    action="applied",
                    confidence=score,
                    reason="high_confidence_fuzzy",
                )
            elif best_id and score >= _REVIEW_FUZZY_THRESHOLD:
                _append_reconcile_detail(
                    details,
                    structured_details,
                    source_entity_type="value_proposition",
                    source_entity_id=vid,
                    target_entity_type="job_story",
                    target_entity_id=best_id,
                    link_kind="addresses_jtbd",
                    action="candidate",
                    confidence=score,
                    reason="low_confidence_fuzzy_manual_review",
                )
        if chosen:
            vp_assignments[vid] = chosen

    still_orphan = [r for r in vp_rows if r["id"] not in vp_assignments]
    if still_orphan and len(jobs) > 1 and llm_json is not None:
        orphan_payload = [{"id": str(r["id"]), "text": _trim_vp_text(str(r["vp_text"] or ""))} for r in still_orphan]
        job_payload = [{"id": str(j[0]), "title": j[1]} for j in jobs]
        mapping = await _llm_assign_value_props_to_jobs(
            llm_json,
            orphans=orphan_payload,
            jobs=job_payload,
        )
        if mapping:
            llm_used = True
        still_ids = {r["id"] for r in still_orphan}
        for vp_id_s, id_list in mapping.items():
            try:
                vpu = UUID(vp_id_s)
            except ValueError:
                continue
            valid = [jid for jid in id_list if jid in job_ids]
            if valid and vpu in still_ids:
                vp_assignments[vpu] = valid
                _append_reconcile_detail(
                    details,
                    structured_details,
                    source_entity_type="value_proposition",
                    source_entity_id=vpu,
                    target_entity_type="job_story",
                    target_entity_id=valid[0],
                    link_kind="addresses_jtbd",
                    action="applied",
                    confidence=None,
                    reason=f"llm_mapping_{len(valid)}_jtbd",
                )

    for vid, jids in vp_assignments.items():
        await update_value_proposition(
            vid,
            ValuePropositionUpdateRequest(job_story_ids=jids),
            db_pool=db_pool,
            user_id=user_id,
        )
        vp_updated += 1

    for row in segment_rows:
        sid: UUID = row["id"]
        blob = f"{row['name'] or ''} {row['description'] or ''}"
        existing_job_links = list(row["linked_job_story_ids"] or [])
        existing_content_links = list(row["linked_content_ids"] or [])
        chosen_j: list[UUID] = []
        chosen_content: list[UUID] = []
        if not existing_job_links and len(jobs) == 1:
            chosen_j = [jobs[0][0]]
            _append_reconcile_detail(
                details,
                structured_details,
                source_entity_type="segment",
                source_entity_id=sid,
                target_entity_type="job_story",
                target_entity_id=jobs[0][0],
                link_kind="linked_job_story",
                action="applied",
                reason="single_candidate",
            )
        elif not existing_job_links and len(jobs) > 1:
            best_id, score = _best_fuzzy_match(blob, jobs)
            if best_id and score >= _AUTO_FUZZY_THRESHOLD:
                chosen_j = [best_id]
                _append_reconcile_detail(
                    details,
                    structured_details,
                    source_entity_type="segment",
                    source_entity_id=sid,
                    target_entity_type="job_story",
                    target_entity_id=best_id,
                    link_kind="linked_job_story",
                    action="applied",
                    confidence=score,
                    reason="high_confidence_fuzzy",
                )
            elif best_id and score >= _REVIEW_FUZZY_THRESHOLD:
                _append_reconcile_detail(
                    details,
                    structured_details,
                    source_entity_type="segment",
                    source_entity_id=sid,
                    target_entity_type="job_story",
                    target_entity_id=best_id,
                    link_kind="linked_job_story",
                    action="candidate",
                    confidence=score,
                    reason="low_confidence_fuzzy_manual_review",
                )
        if not existing_content_links and all_content_choices:
            if len(all_content_choices) == 1:
                chosen_content = [all_content_choices[0][0]]
                _append_reconcile_detail(
                    details,
                    structured_details,
                    source_entity_type="segment",
                    source_entity_id=sid,
                    target_entity_type="content_source",
                    target_entity_id=all_content_choices[0][0],
                    link_kind="linked_content",
                    action="applied",
                    reason="single_candidate",
                )
            else:
                content_id, content_score = _best_fuzzy_match(blob, all_content_choices)
                if content_id and content_score >= _AUTO_FUZZY_THRESHOLD:
                    chosen_content = [content_id]
                    _append_reconcile_detail(
                        details,
                        structured_details,
                        source_entity_type="segment",
                        source_entity_id=sid,
                        target_entity_type="content_source",
                        target_entity_id=content_id,
                        link_kind="linked_content",
                        action="applied",
                        confidence=content_score,
                        reason="high_confidence_fuzzy",
                    )
                elif content_id and content_score >= _REVIEW_FUZZY_THRESHOLD:
                    if llm_json is not None and await _llm_confirm_segment_content_link(
                        llm_json,
                        segment={
                            "id": str(sid),
                            "name": str(row["name"] or ""),
                            "description": str(row["description"] or ""),
                        },
                        content={
                            "id": str(content_id),
                            "title": content_title_by_id.get(content_id, ""),
                            "excerpt": _trim_vp_text(content_choice_text_by_id.get(content_id, ""), max_len=1400),
                        },
                        fuzzy_confidence=content_score,
                    ):
                        chosen_content = [content_id]
                        llm_used = True
                        _append_reconcile_detail(
                            details,
                            structured_details,
                            source_entity_type="segment",
                            source_entity_id=sid,
                            target_entity_type="content_source",
                            target_entity_id=content_id,
                            link_kind="linked_content",
                            action="applied",
                            confidence=content_score,
                            reason="llm_confirmed_low_confidence_fuzzy",
                        )
                    else:
                        _append_reconcile_detail(
                            details,
                            structured_details,
                            source_entity_type="segment",
                            source_entity_id=sid,
                            target_entity_type="content_source",
                            target_entity_id=content_id,
                            link_kind="linked_content",
                            action="candidate",
                            confidence=content_score,
                            reason="low_confidence_fuzzy_manual_review",
                        )
        segment_patch: dict[str, Any] = {}
        if chosen_j:
            segment_patch["linked_job_story_ids"] = chosen_j
        if chosen_content:
            segment_patch["linked_content_ids"] = chosen_content
        if segment_patch:
            await update_segment(
                sid,
                SegmentUpdateRequest(**segment_patch),
                db_pool=db_pool,
                user_id=user_id,
            )
            if chosen_j:
                seg_updated += 1
            if chosen_content:
                segment_evidence_updated += 1

    for row in campaign_rows:
        cid: UUID = row["id"]
        name = str(row["name"] or "")
        async with db_pool.acquire() as conn:
            camp = await conn.fetchrow(
                """
                SELECT linked_segment_ids, linked_value_prop_ids
                FROM marketing_campaigns
                WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL
                """,
                cid,
                project_id,
            )
        if camp is None:
            continue
        seg_links = list(camp["linked_segment_ids"] or [])
        vp_links = list(camp["linked_value_prop_ids"] or [])
        patch_seg: list[UUID] | None = None
        patch_vp: list[UUID] | None = None

        if not seg_links and all_segment_choices:
            if len(all_segment_choices) == 1:
                patch_seg = [all_segment_choices[0][0]]
                details.append(f"Campaign {cid}: единственный сегмент")
            else:
                best_s, sc = _best_fuzzy_match(name, all_segment_choices)
                if best_s and sc >= _AUTO_FUZZY_THRESHOLD:
                    patch_seg = [best_s]
                    _append_reconcile_detail(
                        details,
                        structured_details,
                        source_entity_type="campaign",
                        source_entity_id=cid,
                        target_entity_type="segment",
                        target_entity_id=best_s,
                        link_kind="linked_segment",
                        action="applied",
                        confidence=sc,
                        reason="high_confidence_fuzzy",
                    )
                elif best_s and sc >= _REVIEW_FUZZY_THRESHOLD:
                    _append_reconcile_detail(
                        details,
                        structured_details,
                        source_entity_type="campaign",
                        source_entity_id=cid,
                        target_entity_type="segment",
                        target_entity_id=best_s,
                        link_kind="linked_segment",
                        action="candidate",
                        confidence=sc,
                        reason="low_confidence_fuzzy_manual_review",
                    )

        if not vp_links and all_vp_choices:
            if len(all_vp_choices) == 1:
                patch_vp = [all_vp_choices[0][0]]
                details.append(f"Campaign {cid}: единственный VP")
            else:
                best_v, vc = _best_fuzzy_match(name, all_vp_choices)
                if best_v and vc >= _AUTO_FUZZY_THRESHOLD:
                    patch_vp = [best_v]
                    _append_reconcile_detail(
                        details,
                        structured_details,
                        source_entity_type="campaign",
                        source_entity_id=cid,
                        target_entity_type="value_proposition",
                        target_entity_id=best_v,
                        link_kind="linked_value_proposition",
                        action="applied",
                        confidence=vc,
                        reason="high_confidence_fuzzy",
                    )
                elif best_v and vc >= _REVIEW_FUZZY_THRESHOLD:
                    _append_reconcile_detail(
                        details,
                        structured_details,
                        source_entity_type="campaign",
                        source_entity_id=cid,
                        target_entity_type="value_proposition",
                        target_entity_id=best_v,
                        link_kind="linked_value_proposition",
                        action="candidate",
                        confidence=vc,
                        reason="low_confidence_fuzzy_manual_review",
                    )

        patch_fields: dict[str, Any] = {}
        if patch_seg is not None:
            patch_fields["linked_segment_ids"] = patch_seg
        if patch_vp is not None:
            patch_fields["linked_value_prop_ids"] = patch_vp
        if patch_fields:
            await update_campaign(
                cid,
                CampaignUpdateRequest(**patch_fields),
                db_pool=db_pool,
                user_id=user_id,
            )
            camp_updated += 1

    logger.info(
        "[amka.reconcile] project=%s vp=%s segments=%s segment_evidence=%s campaigns=%s llm=%s",
        project_id,
        vp_updated,
        seg_updated,
        segment_evidence_updated,
        camp_updated,
        llm_used,
    )
    return {
        "value_propositions_updated": vp_updated,
        "segments_updated": seg_updated,
        "segment_evidence_updated": segment_evidence_updated,
        "campaigns_updated": camp_updated,
        "llm_mapping_used": llm_used,
        "details": details[:80],
        "structured_details": structured_details[:120],
    }
