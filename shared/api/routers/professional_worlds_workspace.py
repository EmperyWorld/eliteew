# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Professional Worlds workspace extras: brand visual kit, cross-app draft links, property draft handoffs.
# Invariants:
# - Routes mount on the main Professional Worlds router without a path prefix change.
# - Property draft routes never auto-publish or auto-send cross-app payloads.
# Related:
# - api/routers/professional_worlds_deps.py
# - api/services/professional_worlds/cross_app_drafts_service.py
# ---

from __future__ import annotations

from collections.abc import Mapping
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.routers.professional_worlds_deps import _current_user_id, _service
from api.schemas.professional_worlds import (
    BrandVisualKitOut,
    BrandVisualKitUpsert,
    ProfessionalArtifactOut,
    ProfessionalCrossAppDraftLinkOut,
    ProfessionalCrossAppDraftReportIn,
)
from api.services.professional_worlds.cross_app_draft_adapters import (
    build_ewdesk_suggestion_adapter,
    build_ewrp_draft_adapter,
    build_gaf_chat_draft_adapter,
    build_site_studio_draft_adapter,
    build_unified_content_asset_link,
)
from api.services.professional_worlds.cross_app_drafts_service import (
    ProfessionalCrossAppDraftsService,
    compute_property_digest,
)
from api.services.professional_worlds.service import REALTOR_VERTICAL_SLUG

workspace_router = APIRouter()


def _professional_payload_uuid_list(payload: Mapping[str, Any], key: str) -> list[UUID]:
    """Parse optional UUID sequences from heterogeneous draft payloads."""
    raw_seq = payload.get(key)
    if not isinstance(raw_seq, list):
        return []
    out: list[UUID] = []
    for item in raw_seq:
        try:
            out.append(UUID(str(item)))
        except (TypeError, ValueError):  # fmt: skip
            continue
    return out


def _merge_capsule_unified_content_link(capsule: dict[str, Any], *, property_pk: UUID) -> dict[str, Any]:
    refs: list[UUID] = []
    buckets = ("media_unified_content_ids", "attachment_unified_content_ids")
    for bucket in buckets:
        raw_seq = capsule.get(bucket)
        if isinstance(raw_seq, list):
            for item in raw_seq:
                try:
                    refs.append(UUID(str(item)))
                except (TypeError, ValueError):  # fmt: skip
                    continue
    ordered: list[UUID] = []
    seen_keys: set[str] = set()
    for cid in refs:
        key_txt = str(cid)
        if key_txt in seen_keys:
            continue
        seen_keys.add(key_txt)
        ordered.append(cid)
    enriched = dict(capsule)
    if ordered:
        enriched["unified_content_link"] = build_unified_content_asset_link(ordered, property_id=property_pk)
    return enriched


def _decorate_cross_app_link_row(
    row: Mapping[str, Any],
    drafts_svc: ProfessionalCrossAppDraftsService,
    property_digest_row: Mapping[str, Any] | None,
) -> dict[str, Any]:
    enriched = dict(row)
    capsule = dict(row.get("external_ref") or {})
    prop_block = dict(capsule.get("property") or {})
    cand = prop_block.get("property_id")
    stale = False
    hint: str | None = None
    if property_digest_row is not None and cand is not None and str(cand) == str(property_digest_row.get("id")):
        stale, hint = drafts_svc.recompute_staleness_vs_property_row(
            link_row=enriched,
            property_row=dict(property_digest_row),
        )
    enriched["is_stale"] = stale
    enriched["stale_hint"] = hint if stale else None
    return enriched


@workspace_router.get("/me/brand-visual-kit", response_model=BrandVisualKitOut | None)
async def get_professional_worlds_brand_visual_kit(
    vertical_slug: str = Query(default=REALTOR_VERTICAL_SLUG, max_length=80),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any] | None:
    """Return persisted brand-visual kit hints for Realtor/PW cockpit."""
    slug = vertical_slug.strip() or REALTOR_VERTICAL_SLUG
    return await _service(db).get_brand_visual_kit(_current_user_id(user), slug)


@workspace_router.put("/me/brand-visual-kit", response_model=BrandVisualKitOut)
async def put_professional_worlds_brand_visual_kit(
    payload: BrandVisualKitUpsert,
    vertical_slug: str = Query(default=REALTOR_VERTICAL_SLUG, max_length=80),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Upsert Realtor/PW visual kit prefs (colors, logo ref, typography, watermark prefs)."""
    slug = vertical_slug.strip() or REALTOR_VERTICAL_SLUG
    return await _service(db).upsert_brand_visual_kit(
        _current_user_id(user), dict(payload.kit or {}), vertical_slug=slug
    )


@workspace_router.get("/cross-app/drafts", response_model=list[ProfessionalCrossAppDraftLinkOut])
async def list_professional_cross_app_drafts(
    artifact_id: UUID | None = None,
    stale_check_property_id: UUID | None = None,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """List persisted Professional Worlds cross-app handoff rows."""
    user_id = _current_user_id(user)
    drafts_svc = ProfessionalCrossAppDraftsService(db)
    svc_w = _service(db)
    prop_digest_row: dict[str, Any] | None = None
    if stale_check_property_id is not None:
        pr_row = await svc_w.get_property(user_id, stale_check_property_id)
        if pr_row is not None:
            prop_digest_row = dict(pr_row)
    rows = await drafts_svc.list_links_for_user(user_id, artifact_id=artifact_id)
    return [_decorate_cross_app_link_row(r, drafts_svc, prop_digest_row) for r in rows]


@workspace_router.post("/cross-app/drafts/{link_id}/refresh", response_model=ProfessionalCrossAppDraftLinkOut)
async def refresh_professional_cross_app_draft(
    link_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Refresh cross-app draft lifecycle from remote destination state and local bookkeeping."""
    user_id = _current_user_id(user)
    drafts_svc = ProfessionalCrossAppDraftsService(db)
    refreshed = await drafts_svc.refresh_link_with_remote_sync(user_id, link_id)
    if refreshed is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft link not found")
    return _decorate_cross_app_link_row(refreshed, drafts_svc, None)


@workspace_router.post("/cross-app/drafts/{link_id}/report", response_model=ProfessionalCrossAppDraftLinkOut)
async def report_professional_cross_app_draft(
    link_id: UUID,
    payload: ProfessionalCrossAppDraftReportIn,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Record destination-app lifecycle evidence (opened/published/cancelled) for a draft link."""
    user_id = _current_user_id(user)
    drafts_svc = ProfessionalCrossAppDraftsService(db)
    reported = await drafts_svc.report_client_lifecycle(
        user_id,
        link_id,
        lifecycle_state=payload.lifecycle_state.strip().lower(),
        remote_tracking=payload.remote_tracking,
    )
    if reported is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Draft link not found")
    return _decorate_cross_app_link_row(reported, drafts_svc, None)


@workspace_router.post("/realtor/properties/{property_id}/drafts/{draft_kind}", response_model=ProfessionalArtifactOut)
async def create_realtor_property_draft(
    property_id: UUID,
    draft_kind: str,
    payload: dict[str, Any] = Body(default_factory=dict),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Prepare cross-app draft artifacts; never auto-publishes or auto-sends."""
    allowed = {
        "ewrp": ("presentation_draft", "EWRP presentation draft", "ewrp"),
        "site-studio": ("site_draft", "Site Studio property landing draft", "site_studio"),
        "gaf-chat": ("message_draft", "GAF Chat message draft", "gaf_chat"),
        "ewdesk": ("ewdesk_suggestion", "EWDesk note suggestion", "ewdesk"),
    }
    if draft_kind not in allowed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unknown draft kind")
    user_id = _current_user_id(user)
    service = _service(db)
    property_row = await service.get_property(user_id, property_id)
    if property_row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    digest = compute_property_digest(property_row)
    artifact_kind, default_title, integration_key = allowed[draft_kind]
    content_default = (
        f"Черновик для {default_title}: {property_row['title']}\n"
        f"Город/район: {property_row.get('city')} / {property_row.get('district') or '—'}\n"
        f"Цена: {property_row.get('price') or '—'}\n"
        "Дальнейшая публикация или отправка выполняется только явным действием пользователя."
    )
    content = str(payload.get("content") or content_default)
    prop_dict = dict(property_row)

    artifact = await service.save_artifact(
        user_id=user_id,
        source_type="realtor_property",
        source_id=property_id,
        recipe_key=f"{integration_key}_draft",
        title=str(payload.get("title") or default_title)[:240],
        content=content,
        artifact_data={
            "property": property_row,
            "draft_payload": payload,
            "draft_only": True,
            "cross_app_integration": integration_key,
        },
        module_key="public-presence",
        artifact_kind=artifact_kind,
        export_metadata={
            "integration_key": integration_key,
            "auto_publish": False,
            "auto_send": False,
        },
    )
    artifact_pk = UUID(str(artifact["id"]))

    capsule: dict[str, Any]
    if draft_kind == "ewrp":
        outline = str(payload.get("outline_markdown") or payload.get("outline") or "")
        media_refs = _professional_payload_uuid_list(payload, "unified_content_refs")
        if not media_refs:
            media_refs = _professional_payload_uuid_list(payload, "media_unified_content_ids")
        capsule = build_ewrp_draft_adapter(
            prop_dict,
            outline_markdown=outline or content_default,
            unified_content_refs=media_refs,
            artifact_id=artifact_pk,
        )
    elif draft_kind == "site-studio":
        sections = payload["page_sections"] if isinstance(payload.get("page_sections"), list) else []
        site_refs = _professional_payload_uuid_list(payload, "unified_content_refs") or _professional_payload_uuid_list(
            payload, "media_unified_content_ids"
        )
        capsule = build_site_studio_draft_adapter(
            prop_dict,
            sections=list(sections or []),
            unified_content_refs=site_refs,
            artifact_id=artifact_pk,
            internal_review_required=(
                True if payload.get("internal_review_required") is None else bool(payload["internal_review_required"])
            ),
        )
    elif draft_kind == "gaf-chat":
        recipient_ctx = payload.get("recipient")
        recipient_ctx_dict = recipient_ctx if isinstance(recipient_ctx, dict) else {}
        attachments = _professional_payload_uuid_list(
            payload, "attachment_unified_content_ids"
        ) or _professional_payload_uuid_list(payload, "unified_content_refs")
        msg_body = str(
            payload.get("message_body") or payload.get("message") or payload.get("content") or content_default
        )
        capsule = build_gaf_chat_draft_adapter(
            prop_dict,
            recipient_context=recipient_ctx_dict,
            message_body=msg_body,
            attachment_unified_content_ids=attachments,
            artifact_id=artifact_pk,
        )
    elif draft_kind == "ewdesk":
        md_body = str(
            payload.get("markdown") or payload.get("suggestion_markdown") or payload.get("content") or content_default
        )
        capsule = build_ewdesk_suggestion_adapter(
            prop_dict,
            markdown_body=md_body,
            artifact_id=artifact_pk,
        )
    else:
        raise RuntimeError(f"Unreachable draft_kind {draft_kind!r}")

    merged_capsule = _merge_capsule_unified_content_link(dict(capsule), property_pk=property_id)

    drafts_svc = ProfessionalCrossAppDraftsService(db)
    await drafts_svc.create_link_row(
        user_id=user_id,
        draft_kind=draft_kind[:80],
        artifact_id=artifact_pk,
        vertical_slug="realtor",
        external_ref=merged_capsule,
        source_digest=digest,
    )
    return artifact
