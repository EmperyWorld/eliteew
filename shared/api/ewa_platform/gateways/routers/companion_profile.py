# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Authenticated HTTP CRUD-lite for **one row per principal** companion profile (**EWA companion** memory layer).
# Also exposes the HCM Module A "story" anchor CRUD (chronological landmarks pinned into
# ``companion_memory_v1`` as ``kind=story``) and user forget for any memory row by ``content_hash``.
# Invariants:
# - ``GET …/companion-profile`` hides ``memory_display`` when ``seed_persona_id=arlika`` (hostile v1 only); ``arlika_v2`` shows memory.
# - When ``app.state.ewa_orchestration_pool`` absent, responds **503** with structured ``detail`` (see ``ewa_service_unavailable``).
# - Named **internal** app usernames (see ``trust_username_promotion.TRUST_PROMOTED_USERNAMES``) receive ``baseline.ewa_companion_trust_v1.score``
#   raised to **10** once via shallow-merge when GET or POST initialize loads their profile if score was lower (**audit**: ``companion_trust_username_promotion``).
# - Context anchor operator API (``companion_context_anchor_v1``): read / refresh / patch / diagnose.
# - ``POST …/companion-profile/arlika-v2-mode-toggle`` reuses chat **arlika_v2** switch (sigil click on desktop).
# Related:
# - api/ewa_platform/gateways/ewa_service_unavailable.py
# - api/ewa_platform/persistence_pg/companion_asyncpg.py
# - documentation/product/ewa/EWA-COMPANION-PROFILE-ADR.md
# - api/ewa_platform/companion/context/anchor_ops.py
# ---
"""EWA companion profile HTTP router."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status  # type: ignore[import-untyped]

from api.core.auth import User
from api.core.oauth2_auth import require_oauth2_user
from api.ewa_platform.companion.context.anchor_ops import (
    companion_context_anchor_patch_merge,
    companion_context_anchor_refresh,
    companion_context_diagnose_bundle,
    context_anchor_get_blob,
)
from api.ewa_platform.companion.memory import (
    MEMORY_NS,
    companion_memory_display_lines,
    delete_memory_by_content_hash,
    get_memory,
    merge_memory_entries,
    normalize_memory_list,
)
from api.ewa_platform.companion.persona.character import (
    CHARACTER_NS,
    character_display_state,
    get_character,
    initial_character_for_principal,
)
from api.ewa_platform.companion.sidecar.arlika_v2_chat_switch import (
    try_apply_arlika_v2_chat_mode_switch,
)
from api.ewa_platform.companion.sidecar.trust_state import ARLIKA_V2_SEED
from api.ewa_platform.companion.sidecar.trust_username_promotion import (
    companion_trust_promotion_baseline_delta,
)
from api.ewa_platform.companion.ux.reactive_chrome import companion_reactive_chrome_enabled
from api.ewa_platform.companion.voice.config import companion_voice_enabled
from api.ewa_platform.gateways.ewa_service_unavailable import ewa_pool_unavailable_exception
from api.ewa_platform.persistence_pg import companion_asyncpg as companion_pg
from api.ewa_platform.schemas.pydantic.companion import (
    CompanionArlikaV2ModeToggleOut,
    CompanionContextAnchorGetOut,
    CompanionContextAnchorPatchIn,
    CompanionContextAnchorRefreshIn,
    CompanionContextAnchorRefreshOut,
    CompanionContextDiagnoseIn,
    CompanionContextDiagnoseOut,
    CompanionInitializeIn,
    CompanionOkOut,
    CompanionPatchIn,
    CompanionProfileOut,
    CompanionQuickPresetCreateIn,
    CompanionQuickPresetOut,
    CompanionQuickPresetPatchIn,
    CompanionStoryAddIn,
    CompanionStoryRowOut,
)

router = APIRouter(tags=["EWA - Companion profile"])


def _pool(request: Request) -> Any | None:
    return getattr(request.app.state, "ewa_orchestration_pool", None)


def _principal(user: User) -> str:
    return str(user.id)


async def _maybe_promote_trust_username(
    pool: Any,
    *,
    principal_id: str,
    username: str,
    row: dict[str, Any],
) -> dict[str, Any]:
    """Lift ``ewa_companion_trust_v1`` for allowlisted usernames (best-effort patch)."""

    raw_b = row.get("baseline")
    baseline = raw_b if isinstance(raw_b, dict) else None
    delta = companion_trust_promotion_baseline_delta(username=username, baseline=baseline)
    if delta is None:
        return row
    patched = await companion_pg.companion_profile_patch(
        pool,
        principal_id=principal_id,
        baseline=delta,
        audit_action="companion_trust_username_promotion",
        audit_detail_override={
            "username": str(username).strip().lower(),
            "trust_promoted_to": 10,
        },
    )
    return patched if patched is not None else row


def _shape_profile(row: dict[str, Any]) -> CompanionProfileOut:
    learned = row.get("learned_preferences")
    learned_map = learned if isinstance(learned, dict) else {}
    seed = str(row.get("seed_persona_id") or "").strip().lower()
    memory_lines = [] if seed == "arlika" else companion_memory_display_lines(learned_map)
    return CompanionProfileOut.model_validate(
        {
            **row,
            "memory_display": memory_lines,
            "character_state": character_display_state(
                get_character(row),
                seed_persona_id=str(row.get("seed_persona_id") or ""),
            ),
            "voice_enabled": companion_voice_enabled(),
            "reactive_chrome_enabled": companion_reactive_chrome_enabled(),
        }
    )


@router.get(
    "/companion-profile",
    response_model=CompanionProfileOut,
    operation_id="ewa_companion_profile_get",
    summary="Get current user's EWA companion profile",
)
async def get_companion_profile(
    request: Request,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> CompanionProfileOut:
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()

    pid = _principal(auth_user)
    row = await companion_pg.companion_profile_fetch(pool, principal_id=pid)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_profile_not_initialized")
    row = await _maybe_promote_trust_username(
        pool,
        principal_id=pid,
        username=auth_user.username,
        row=row,
    )
    return _shape_profile(row)


@router.post(
    "/companion-profile/initialize",
    response_model=CompanionProfileOut,
    operation_id="ewa_companion_profile_initialize",
    summary="Initialize companion profile seed (no-op overwrite if row exists)",
)
async def initialize_companion_profile(
    request: Request,
    body: CompanionInitializeIn,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> CompanionProfileOut:
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()

    pid = _principal(auth_user)
    baseline_override: dict[str, Any] = dict(body.baseline or {})
    promo = companion_trust_promotion_baseline_delta(
        username=auth_user.username,
        baseline=baseline_override,
    )
    if promo:
        baseline_override.update(promo)
    profile = await companion_pg.companion_profile_initialize(
        pool,
        principal_id=pid,
        seed_persona_id=body.seed_persona_id,
        baseline_override=baseline_override if baseline_override else None,
    )

    profile = await _maybe_promote_trust_username(
        pool,
        principal_id=pid,
        username=auth_user.username,
        row=profile,
    )
    # If this principal had no character block yet (fresh row OR legacy row created before iter2-uniqueness), seed
    # one with deterministic ±0.10 trait jitter derived from `(principal_id, seed_persona_id)`. The patch is a no-op
    # for users who already have a character block — we want to evolve it, not overwrite the lived-in personality.
    learned = profile.get("learned_preferences")
    has_character = isinstance(learned, dict) and isinstance(learned.get(CHARACTER_NS), dict)
    if not has_character:
        seed = str(profile.get("seed_persona_id") or body.seed_persona_id or "parent").strip().lower()
        merged = dict(learned) if isinstance(learned, dict) else {}
        merged[CHARACTER_NS] = initial_character_for_principal(pid, seed)
        revision = int(profile.get("companion_revision") or 1)
        patched = await companion_pg.companion_profile_patch(
            pool,
            principal_id=pid,
            learned_preferences=merged,
            expect_revision=revision,
            audit_action="character_jitter_seeded",
            audit_detail_override={"seed_persona_id": seed},
        )
        if patched is not None:
            return _shape_profile(patched)

    return _shape_profile(profile)


@router.patch(
    "/companion-profile",
    response_model=CompanionProfileOut,
    operation_id="ewa_companion_profile_patch",
    summary="Merge JSON blobs into companion profile (optimistic versioning optional)",
)
async def patch_companion_profile(
    request: Request,
    body: CompanionPatchIn,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> CompanionProfileOut:
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()

    pid = _principal(auth_user)
    patched = await companion_pg.companion_profile_patch(
        pool,
        principal_id=pid,
        baseline=body.baseline,
        learned_preferences=body.learned_preferences,
        style_parameters=body.style_parameters,
        expect_revision=body.expect_revision,
    )
    if patched is None:
        if body.expect_revision is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="companion_revision_mismatch_or_missing_row"
            )
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_profile_not_initialized")
    return _shape_profile(patched)


_ARLIKA_V2_TOGGLE_TO_V2_LINE = "Переключись в режим арлики"
_ARLIKA_V2_TOGGLE_TO_EWA_LINE = "Вернись к обычной EWA"


@router.post(
    "/companion-profile/arlika-v2-mode-toggle",
    response_model=CompanionArlikaV2ModeToggleOut,
    operation_id="ewa_companion_profile_arlika_v2_mode_toggle",
    summary="Toggle EWA companion ↔ friendly Arlika v2 (same contract as chat phrase switch)",
)
async def toggle_arlika_v2_mode(
    request: Request,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> CompanionArlikaV2ModeToggleOut:
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()

    pid = _principal(auth_user)
    row = await companion_pg.companion_profile_fetch(pool, principal_id=pid)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_profile_not_initialized")

    seed = str(row.get("seed_persona_id") or "").strip().lower()
    if seed == "arlika":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="arlika_v1_active_calm_first",
        )

    user_line = _ARLIKA_V2_TOGGLE_TO_EWA_LINE if seed == ARLIKA_V2_SEED else _ARLIKA_V2_TOGGLE_TO_V2_LINE
    profile = dict(row)
    patched, switched, transform_kind = await try_apply_arlika_v2_chat_mode_switch(
        pool,
        principal_id=pid,
        profile=profile,
        user_line=user_line,
    )
    if not switched or patched is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="arlika_v2_mode_not_available",
        )

    shaped = _shape_profile(patched)
    return CompanionArlikaV2ModeToggleOut.model_validate(
        {
            **shaped.model_dump(),
            "switched": True,
            "transform_event_kind": transform_kind,
        }
    )


@router.get(
    "/companion-profile/quick-actions",
    response_model=list[CompanionQuickPresetOut],
    operation_id="ewa_companion_quick_actions_list",
    summary="List current user's EWA companion quick action presets",
)
async def list_companion_quick_actions(
    request: Request,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[CompanionQuickPresetOut]:
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    rows = await companion_pg.companion_quick_presets_list(pool, principal_id=_principal(auth_user))
    return [CompanionQuickPresetOut.model_validate(row) for row in rows]


@router.post(
    "/companion-profile/quick-actions",
    response_model=CompanionQuickPresetOut,
    operation_id="ewa_companion_quick_actions_create",
    summary="Create current user's EWA companion quick action preset",
)
async def create_companion_quick_action(
    request: Request,
    body: CompanionQuickPresetCreateIn,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> CompanionQuickPresetOut:
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    row = await companion_pg.companion_quick_preset_create(
        pool,
        principal_id=_principal(auth_user),
        label=body.label,
        prompt_text=body.prompt_text,
        sort_order=body.sort_order,
    )
    return CompanionQuickPresetOut.model_validate(row)


@router.patch(
    "/companion-profile/quick-actions/{preset_id}",
    response_model=CompanionQuickPresetOut,
    operation_id="ewa_companion_quick_actions_patch",
    summary="Patch current user's EWA companion quick action preset",
)
async def patch_companion_quick_action(
    preset_id: str,
    request: Request,
    body: CompanionQuickPresetPatchIn,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> CompanionQuickPresetOut:
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    row = await companion_pg.companion_quick_preset_update(
        pool,
        principal_id=_principal(auth_user),
        preset_id=preset_id,
        label=body.label,
        prompt_text=body.prompt_text,
        sort_order=body.sort_order,
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="quick_action_preset_not_found")
    return CompanionQuickPresetOut.model_validate(row)


@router.delete(
    "/companion-profile/quick-actions/{preset_id}",
    response_model=CompanionOkOut,
    operation_id="ewa_companion_quick_actions_delete",
    summary="Delete current user's EWA companion quick action preset",
)
async def delete_companion_quick_action(
    preset_id: str,
    request: Request,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> CompanionOkOut:
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    ok = await companion_pg.companion_quick_preset_delete(
        pool,
        principal_id=_principal(auth_user),
        preset_id=preset_id,
    )
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="quick_action_preset_not_found")
    return CompanionOkOut(ok=True)


def _shape_story_rows(memory_rows: list[dict[str, Any]]) -> list[CompanionStoryRowOut]:
    """Filter memory list down to ``kind=='story'`` for the dedicated UI strip."""

    out: list[CompanionStoryRowOut] = []
    for row in memory_rows:
        if str(row.get("kind") or "").strip().lower() != "story":
            continue
        out.append(
            CompanionStoryRowOut.model_validate(
                {
                    "content": row.get("content") or "",
                    "importance": float(row.get("importance") or 0.0),
                    "valence": float(row.get("valence") or 0.0),
                    "since_ts": str(row.get("since_ts") or ""),
                    "last_used_ts": str(row.get("last_used_ts") or ""),
                    "content_hash": str(row.get("content_hash") or ""),
                }
            )
        )
    return out


@router.get(
    "/companion-profile/story",
    response_model=list[CompanionStoryRowOut],
    operation_id="ewa_companion_profile_story_list",
    summary="List chronological 'story' anchors stored in companion_memory_v1 (HCM L3 identity)",
)
async def list_companion_story(
    request: Request,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[CompanionStoryRowOut]:
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    pid = _principal(auth_user)
    row = await companion_pg.companion_profile_fetch(pool, principal_id=pid)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_profile_not_initialized")
    return _shape_story_rows(get_memory(row))


@router.post(
    "/companion-profile/story",
    response_model=list[CompanionStoryRowOut],
    operation_id="ewa_companion_profile_story_add",
    summary="Append one 'story' anchor to companion_memory_v1 (HCM L3 identity)",
)
async def add_companion_story(
    request: Request,
    body: CompanionStoryAddIn,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[CompanionStoryRowOut]:
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    pid = _principal(auth_user)
    row = await companion_pg.companion_profile_fetch(pool, principal_id=pid)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_profile_not_initialized")

    existing = get_memory(row)
    merged, added = merge_memory_entries(
        existing,
        [
            {
                "type": "fact",
                "kind": "story",
                "content": body.content,
                "importance": body.importance,
                "valence": body.valence,
                "confidence": 0.95,
                "source": "user_explicit",
            }
        ],
    )
    if added == 0:
        # Duplicate by content hash — treat as no-op and return current story snapshot.
        return _shape_story_rows(existing)

    learned_raw = row.get("learned_preferences")
    learned = dict(learned_raw) if isinstance(learned_raw, dict) else {}
    learned[MEMORY_NS] = [dict(r) for r in merged]
    revision = int(row.get("companion_revision") or 1)
    patched = await companion_pg.companion_profile_patch(
        pool,
        principal_id=pid,
        learned_preferences=learned,
        expect_revision=revision,
        audit_action="companion_story_add",
        audit_detail_override={"story_added": 1, "content_chars": len(body.content)},
    )
    if patched is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="companion_revision_mismatch_or_missing_row")
    return _shape_story_rows(get_memory(patched))


@router.delete(
    "/companion-profile/story/{content_hash}",
    response_model=list[CompanionStoryRowOut],
    operation_id="ewa_companion_profile_story_delete",
    summary="Delete one 'story' anchor by content_hash",
)
async def delete_companion_story(
    content_hash: str,
    request: Request,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[CompanionStoryRowOut]:
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    pid = _principal(auth_user)
    row = await companion_pg.companion_profile_fetch(pool, principal_id=pid)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_profile_not_initialized")

    existing = normalize_memory_list(get_memory(row))
    target = (content_hash or "").strip().lower()
    kept = [r for r in existing if not (r.get("kind") == "story" and str(r.get("content_hash") or "") == target)]
    if len(kept) == len(existing):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_story_not_found")

    learned_raw = row.get("learned_preferences")
    learned = dict(learned_raw) if isinstance(learned_raw, dict) else {}
    learned[MEMORY_NS] = [dict(r) for r in kept]
    revision = int(row.get("companion_revision") or 1)
    patched = await companion_pg.companion_profile_patch(
        pool,
        principal_id=pid,
        learned_preferences=learned,
        expect_revision=revision,
        audit_action="companion_story_delete",
        audit_detail_override={"story_content_hash": target},
    )
    if patched is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="companion_revision_mismatch_or_missing_row")
    return _shape_story_rows(get_memory(patched))


@router.delete(
    "/companion-profile/memory/{content_hash}",
    response_model=CompanionProfileOut,
    operation_id="ewa_companion_profile_memory_forget",
    summary="Forget one companion_memory_v1 row by content_hash (user-initiated)",
)
async def forget_companion_memory(
    content_hash: str,
    request: Request,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> CompanionProfileOut:
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    pid = _principal(auth_user)
    row = await companion_pg.companion_profile_fetch(pool, principal_id=pid)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_profile_not_initialized")

    existing = normalize_memory_list(get_memory(row))
    kept, removed = delete_memory_by_content_hash(existing, content_hash)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_memory_not_found")

    learned_raw = row.get("learned_preferences")
    learned = dict(learned_raw) if isinstance(learned_raw, dict) else {}
    learned[MEMORY_NS] = [dict(r) for r in kept]
    revision = int(row.get("companion_revision") or 1)
    patched = await companion_pg.companion_profile_patch(
        pool,
        principal_id=pid,
        learned_preferences=learned,
        expect_revision=revision,
        audit_action="companion_memory_forget",
        audit_detail_override={"memory_content_hash": (content_hash or "").strip().lower()},
    )
    if patched is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="companion_revision_mismatch_or_missing_row")
    return _shape_profile(patched)


@router.get(
    "/companion-profile/context-anchor",
    response_model=CompanionContextAnchorGetOut,
    operation_id="ewa_companion_context_anchor_get",
    summary="Read raw context anchor blob (companion_context_anchor_v1)",
)
async def get_companion_context_anchor(
    request: Request,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> CompanionContextAnchorGetOut:
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    pid = _principal(auth_user)
    row = await companion_pg.companion_profile_fetch(pool, principal_id=pid)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_profile_not_initialized")
    blob = context_anchor_get_blob(row)
    return CompanionContextAnchorGetOut.model_validate(
        {"anchor": blob, "companion_revision": int(row.get("companion_revision") or 1)}
    )


@router.post(
    "/companion-profile/context-anchor/refresh",
    response_model=CompanionContextAnchorRefreshOut,
    operation_id="ewa_companion_context_anchor_refresh",
    summary="Refresh context anchor using chat tail + optional LLM (writes learned_preferences)",
)
async def post_companion_context_anchor_refresh(
    request: Request,
    body: CompanionContextAnchorRefreshIn,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> CompanionContextAnchorRefreshOut:
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    pid = _principal(auth_user)
    patched, telem = await companion_context_anchor_refresh(
        pool,
        principal_id=pid,
        user_line=body.user_line,
        trigger_reason="operator_http_refresh",
    )
    if patched is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_profile_not_initialized")
    return CompanionContextAnchorRefreshOut.model_validate(
        {
            "profile": _shape_profile(patched),
            "telemetry": telem,
        }
    )


@router.patch(
    "/companion-profile/context-anchor",
    response_model=CompanionProfileOut,
    operation_id="ewa_companion_context_anchor_patch",
    summary="Shallow-merge fields into companion_context_anchor_v1",
)
async def patch_companion_context_anchor(
    request: Request,
    body: CompanionContextAnchorPatchIn,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> CompanionProfileOut:
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    pid = _principal(auth_user)
    row = await companion_pg.companion_profile_fetch(pool, principal_id=pid)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_profile_not_initialized")
    patched = await companion_context_anchor_patch_merge(pool, principal_id=pid, patch=body.patch)
    if patched is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="companion_revision_mismatch_or_missing_row")
    return _shape_profile(patched)


@router.post(
    "/companion-profile/context-anchor/diagnose",
    response_model=CompanionContextDiagnoseOut,
    operation_id="ewa_companion_context_anchor_diagnose",
    summary="Dry-run context risk flags (noise / drift / bloat / action execution heuristics)",
)
async def post_companion_context_anchor_diagnose(
    request: Request,
    body: CompanionContextDiagnoseIn,
    auth_user: User = Depends(require_oauth2_user),  # noqa: B008
) -> CompanionContextDiagnoseOut:
    pool = _pool(request)
    if pool is None:
        raise ewa_pool_unavailable_exception()
    pid = _principal(auth_user)
    row = await companion_pg.companion_profile_fetch(pool, principal_id=pid)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="companion_profile_not_initialized")
    return CompanionContextDiagnoseOut.model_validate(
        companion_context_diagnose_bundle(row, system_prompt_sample=body.system_prompt_sample)
    )
