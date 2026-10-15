# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop shell-state REST: wire models, ETag field headers, GET/PATCH /shell-state.
# Wave C: Prometheus SLI on GET/PATCH ``/shell-state``.
# P2: row ``FOR UPDATE`` + optional Redis ``Idempotency-Key`` on PATCH (fail-closed when key present).
# Invariants:
# - Mounted without extra prefix under parent ``/desktop`` router; OAuth2 on user-facing routes.
# - Metrics emit is best-effort and must not change HTTP outcomes.
# Related:
# - api/routers/desktop_shell_config.py (aggregator)
# - api/routers/desktop_shell_state_sanitize.py
# - api/routers/desktop_shell_etag.py
# - api/services/desktop_shell_state_idempotency.py
# ---
"""Desktop shell-state API routes."""

import json
import time
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.core.auth import User as AuthUser
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.models.desktop import DesktopConfig
from api.monitoring.metrics import (
    observe_desktop_shell_state_get_304,
    observe_desktop_shell_state_patch,
)
from api.routers.desktop_shell_config_routes import (
    _get_desktop_user_id,
    _get_or_create_desktop_config_row,
)
from api.routers.desktop_shell_etag import (
    _if_none_match_matches,
    _stable_json_digest,
    _weak_etag_for_pydantic_model,
)
from api.routers.desktop_shell_state_sanitize import (
    MAX_RECENT_APP_IDS,
    MAX_RECENT_FILE_IDS,
    MAX_SHELL_TIMEZONE_LEN,
    _sanitize_clipboard_shell_history,
    _sanitize_music_playback_shell,
    _sanitize_music_playlists_shell,
    _sanitize_now_playing_shell,
    _sanitize_recent_app_ids_by_desktop,
    _sanitize_virtual_desktops,
    _sanitize_visual_style_presets_shell,
    _sanitize_windows_snapshot,
)
from api.services.desktop_shell_state_idempotency import (
    ShellStateInProgressError,
    ShellStateRedisUnavailableError,
)

router = APIRouter(tags=["desktop"])


class DesktopWorkspaceProfileWire(BaseModel):
    """Single workspace profile in shell_state.workspace_profiles.profiles."""

    model_config = ConfigDict(extra="ignore")

    id: str = Field(min_length=1, max_length=64)
    name: str = Field(default="", max_length=120)
    description: str | None = Field(default=None, max_length=500)
    desktopId: str | None = Field(default=None, max_length=64)
    wallpaper: str | None = Field(default=None, max_length=4096)
    appIds: list[str] = Field(default_factory=list)
    folderItemIds: list[str] = Field(default_factory=list)
    widgetIds: list[str] = Field(default_factory=list)


class DesktopWorkspaceProfilesWire(BaseModel):
    profiles: list[DesktopWorkspaceProfileWire] = Field(default_factory=list)


class DesktopWindowLayoutPresetWire(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(min_length=1, max_length=64)
    name: str = Field(default="", max_length=120)
    description: str | None = Field(default=None, max_length=500)
    windows: list[dict[str, Any]] = Field(default_factory=list)
    createdAt: str | None = Field(default=None, max_length=64)


class DesktopAppCollectionWire(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(min_length=1, max_length=64)
    name: str = Field(default="", max_length=120)
    description: str | None = Field(default=None, max_length=500)
    appIds: list[str] = Field(default_factory=list)
    workspaceProfileId: str | None = Field(default=None, max_length=64)


class DesktopContentShortcutWire(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(min_length=1, max_length=64)
    label: str = Field(default="", max_length=120)
    type: str = Field(default="project-folder", max_length=40)
    target: dict[str, str] = Field(default_factory=dict)
    workspaceProfileId: str | None = Field(default=None, max_length=64)


class DesktopAssistantContextActionWire(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(min_length=1, max_length=64)
    label: str = Field(default="", max_length=120)
    description: str | None = Field(default=None, max_length=500)
    source: str = Field(default="selection", max_length=40)
    assistantTarget: str = Field(default="assistant", max_length=20)
    enabled: bool = True


class DesktopWidgetLayoutSlotWire(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(min_length=1, max_length=64)
    type: str = Field(default="notes", max_length=40)
    enabled: bool = True
    mode: str = Field(default="compact", max_length=20)
    position: dict[str, Any] | None = None
    workspaceProfileId: str | None = Field(default=None, max_length=64)


class DesktopWidgetsLayoutWire(BaseModel):
    model_config = ConfigDict(extra="ignore")

    slots: list[DesktopWidgetLayoutSlotWire] = Field(default_factory=list)
    perWorkspace: bool = False
    panelOffset: dict[str, Any] | None = None
    slotPlacement: str | None = Field(default=None, max_length=20)


def _coerce_workspace_profiles_wire(raw: object) -> DesktopWorkspaceProfilesWire | None:
    if not isinstance(raw, dict):
        return None
    try:
        return DesktopWorkspaceProfilesWire.model_validate(raw)
    except ValidationError:
        return None


def _coerce_window_layout_presets_wire(raw: object) -> list[DesktopWindowLayoutPresetWire]:
    if not isinstance(raw, list):
        return []
    out: list[DesktopWindowLayoutPresetWire] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        try:
            out.append(DesktopWindowLayoutPresetWire.model_validate(item))
        except ValidationError:
            continue
    return out


def _coerce_app_collections_wire(raw: object) -> list[DesktopAppCollectionWire]:
    if not isinstance(raw, list):
        return []
    out: list[DesktopAppCollectionWire] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        try:
            out.append(DesktopAppCollectionWire.model_validate(item))
        except ValidationError:
            continue
    return out


def _coerce_content_shortcuts_wire(raw: object) -> list[DesktopContentShortcutWire]:
    if not isinstance(raw, list):
        return []
    out: list[DesktopContentShortcutWire] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        try:
            out.append(DesktopContentShortcutWire.model_validate(item))
        except ValidationError:
            continue
    return out


def _coerce_assistant_actions_wire(raw: object) -> list[DesktopAssistantContextActionWire]:
    if not isinstance(raw, list):
        return []
    out: list[DesktopAssistantContextActionWire] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        try:
            out.append(DesktopAssistantContextActionWire.model_validate(item))
        except ValidationError:
            continue
    return out


def _coerce_widgets_layout_wire(raw: object) -> DesktopWidgetsLayoutWire | None:
    if not isinstance(raw, dict):
        return None
    try:
        return DesktopWidgetsLayoutWire.model_validate(raw)
    except ValidationError:
        return None


class DesktopShellStateOut(BaseModel):
    """Normalized shell state returned by GET /desktop/shell-state."""

    recent_app_ids: list[str] = Field(default_factory=list)
    recent_app_ids_by_desktop: dict[str, list[str]] = Field(default_factory=dict)
    recent_file_ids: list[str] = Field(default_factory=list)
    clipboard_history: list[dict[str, Any]] = Field(default_factory=list)
    virtual_desktops: dict[str, Any] | None = None
    windows_snapshot: dict[str, Any] | None = None
    workspace_profiles: DesktopWorkspaceProfilesWire | None = None
    window_layout_presets: list[DesktopWindowLayoutPresetWire] = Field(default_factory=list)
    widgets_layout: DesktopWidgetsLayoutWire | None = None
    app_collections: list[DesktopAppCollectionWire] = Field(default_factory=list)
    content_shortcuts: list[DesktopContentShortcutWire] = Field(default_factory=list)
    assistant_context_actions: list[DesktopAssistantContextActionWire] = Field(default_factory=list)
    clock_show_seconds: bool | None = None
    timezone: str | None = None
    quiet_mode: bool | None = None
    now_playing: dict[str, Any] | None = None
    music_playback: dict[str, Any] | None = None
    gaf_chat_sound_enabled: bool | None = None
    tray_show_feedback: bool | None = None
    tray_show_assistant: bool | None = None
    music_playlists: list[dict[str, Any]] = Field(default_factory=list)
    visual_style_presets: list[dict[str, Any]] = Field(default_factory=list)
    ewa_hints: dict[str, Any] | None = None


class DesktopShellStatePatch(BaseModel):
    """Partial update; null/absent keys are ignored (no field deletion)."""

    recent_app_ids: list[str] | None = None
    recent_app_ids_by_desktop: dict[str, list[str]] | None = None
    recent_file_ids: list[str] | None = None
    clipboard_history: list[Any] | None = None
    virtual_desktops: dict[str, Any] | None = None
    windows_snapshot: dict[str, Any] | None = None
    workspace_profiles: DesktopWorkspaceProfilesWire | None = None
    window_layout_presets: list[DesktopWindowLayoutPresetWire] | None = None
    widgets_layout: DesktopWidgetsLayoutWire | None = None
    app_collections: list[DesktopAppCollectionWire] | None = None
    content_shortcuts: list[DesktopContentShortcutWire] | None = None
    assistant_context_actions: list[DesktopAssistantContextActionWire] | None = None
    clock_show_seconds: bool | None = None
    timezone: str | None = None
    quiet_mode: bool | None = None
    now_playing: dict[str, Any] | None = None
    music_playback: dict[str, Any] | None = None
    gaf_chat_sound_enabled: bool | None = None
    tray_show_feedback: bool | None = None
    tray_show_assistant: bool | None = None
    music_playlists: list[Any] | None = None
    visual_style_presets: list[Any] | None = None
    ewa_hints: dict[str, Any] | None = None

    @field_validator("now_playing")
    @classmethod
    def sanitize_now_playing_patch(cls, v: Any) -> dict[str, Any] | None:
        if v is None:
            return None
        if not isinstance(v, dict):
            return None
        return _sanitize_now_playing_shell(v)

    @field_validator("music_playback")
    @classmethod
    def sanitize_music_playback_patch(cls, v: Any) -> dict[str, Any] | None:
        if v is None:
            return None
        return _sanitize_music_playback_shell(v)

    @field_validator("clipboard_history")
    @classmethod
    def sanitize_clipboard_history_patch(cls, v: list[Any] | None) -> list[dict[str, Any]] | None:
        if v is None:
            return None
        return _sanitize_clipboard_shell_history(v)

    @field_validator("windows_snapshot", mode="before")
    @classmethod
    def sanitize_windows_snapshot_patch(cls, v: Any) -> dict[str, Any] | None:
        if v is None:
            return None
        return _sanitize_windows_snapshot(v)

    @field_validator("virtual_desktops", mode="before")
    @classmethod
    def sanitize_virtual_desktops_patch(cls, v: Any) -> dict[str, Any] | None:
        if v is None:
            return None
        return _sanitize_virtual_desktops(v, None)

    @field_validator("recent_app_ids")
    @classmethod
    def trim_recent_apps(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        cleaned: list[str] = []
        for raw in v:
            if not isinstance(raw, str):
                continue
            s = raw.strip()
            if not s or len(s) > 120:
                continue
            if s not in cleaned:
                cleaned.append(s)
            if len(cleaned) >= MAX_RECENT_APP_IDS:
                break
        return cleaned

    @field_validator("recent_app_ids_by_desktop")
    @classmethod
    def sanitize_recent_app_ids_by_desktop_patch(
        cls,
        v: object,
    ) -> dict[str, list[str]] | None:
        if v is None:
            return None
        return _sanitize_recent_app_ids_by_desktop(v)

    @field_validator("recent_file_ids")
    @classmethod
    def trim_recent_files(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        cleaned: list[str] = []
        for raw in v:
            if not isinstance(raw, str):
                continue
            s = raw.strip()
            if not s or len(s) > 120:
                continue
            if s not in cleaned:
                cleaned.append(s)
            if len(cleaned) >= MAX_RECENT_FILE_IDS:
                break
        return cleaned

    @field_validator("timezone")
    @classmethod
    def trim_timezone(cls, v: str | None) -> str | None:
        if v is None:
            return None
        s = v.strip()
        if not s:
            return None
        return s[:MAX_SHELL_TIMEZONE_LEN]

    @field_validator("music_playlists")
    @classmethod
    def sanitize_music_playlists_patch(cls, v: Any) -> list[dict[str, Any]] | None:
        if v is None:
            return None
        return _sanitize_music_playlists_shell(v)

    @field_validator("visual_style_presets")
    @classmethod
    def sanitize_visual_style_presets_patch(cls, v: Any) -> list[dict[str, Any]] | None:
        if v is None:
            return None
        return _sanitize_visual_style_presets_shell(v)

    @field_validator("ewa_hints", mode="before")
    @classmethod
    def sanitize_ewa_hints_patch(cls, v: Any) -> dict[str, Any] | None:
        if v is None:
            return None
        if not isinstance(v, dict):
            return None
        return dict(v)


def _normalize_shell_state(raw: object) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {}
    return dict(raw)


def _persist_shell_state_sanitized_fields(current: dict[str, Any]) -> None:
    ws = _sanitize_windows_snapshot(current.get("windows_snapshot"))
    if ws is not None:
        current["windows_snapshot"] = ws
    vd = _sanitize_virtual_desktops(current.get("virtual_desktops"), ws)
    if vd is not None:
        current["virtual_desktops"] = vd
    elif "virtual_desktops" in current and not isinstance(current.get("virtual_desktops"), dict):
        current.pop("virtual_desktops", None)


def _shell_state_to_out(data: dict[str, Any]) -> DesktopShellStateOut:
    recent = data.get("recent_app_ids")
    ids: list[str] = []
    if isinstance(recent, list):
        for x in recent:
            if isinstance(x, str) and x.strip():
                s = x.strip()
                if len(s) <= 120 and s not in ids:
                    ids.append(s)
            if len(ids) >= MAX_RECENT_APP_IDS:
                break
    recent_by_desktop = _sanitize_recent_app_ids_by_desktop(data.get("recent_app_ids_by_desktop"))
    file_ids_raw = data.get("recent_file_ids")
    file_ids: list[str] = []
    if isinstance(file_ids_raw, list):
        for x in file_ids_raw:
            if isinstance(x, str) and x.strip():
                s = x.strip()
                if len(s) <= 120 and s not in file_ids:
                    file_ids.append(s)
            if len(file_ids) >= MAX_RECENT_FILE_IDS:
                break
    ws = _sanitize_windows_snapshot(data.get("windows_snapshot"))
    vd = _sanitize_virtual_desktops(data.get("virtual_desktops"), ws)
    workspace_profiles = data.get("workspace_profiles")
    window_layout_presets = data.get("window_layout_presets")
    widgets_layout = data.get("widgets_layout")
    app_collections = data.get("app_collections")
    content_shortcuts = data.get("content_shortcuts")
    assistant_context_actions = data.get("assistant_context_actions")
    cs_raw = data.get("clock_show_seconds")
    tz_raw = data.get("timezone")
    qm_raw = data.get("quiet_mode")
    gcs_raw = data.get("gaf_chat_sound_enabled")
    tsf_raw = data.get("tray_show_feedback")
    tsa_raw = data.get("tray_show_assistant")
    clip = _sanitize_clipboard_shell_history(data.get("clipboard_history"))
    np_raw = data.get("now_playing")
    now_playing = _sanitize_now_playing_shell(np_raw) if isinstance(np_raw, dict) and np_raw else None
    mpb_raw = data.get("music_playback")
    music_playback = _sanitize_music_playback_shell(mpb_raw) if isinstance(mpb_raw, dict) and mpb_raw else None
    mp_raw = data.get("music_playlists")
    music_playlists = _sanitize_music_playlists_shell(mp_raw if mp_raw is not None else [])
    visual_style_presets = _sanitize_visual_style_presets_shell(data.get("visual_style_presets"))
    aph_raw = data.get("ewa_hints")
    ewa_hints = aph_raw if isinstance(aph_raw, dict) else None
    return DesktopShellStateOut(
        recent_app_ids=ids,
        recent_app_ids_by_desktop=recent_by_desktop,
        recent_file_ids=file_ids,
        clipboard_history=clip,
        virtual_desktops=vd,
        windows_snapshot=ws,
        workspace_profiles=_coerce_workspace_profiles_wire(workspace_profiles),
        window_layout_presets=_coerce_window_layout_presets_wire(window_layout_presets),
        widgets_layout=_coerce_widgets_layout_wire(widgets_layout),
        app_collections=_coerce_app_collections_wire(app_collections),
        content_shortcuts=_coerce_content_shortcuts_wire(content_shortcuts),
        assistant_context_actions=_coerce_assistant_actions_wire(assistant_context_actions),
        clock_show_seconds=cs_raw if isinstance(cs_raw, bool) else None,
        timezone=tz_raw if isinstance(tz_raw, str) else None,
        quiet_mode=qm_raw if isinstance(qm_raw, bool) else None,
        now_playing=now_playing,
        music_playback=music_playback,
        gaf_chat_sound_enabled=gcs_raw if isinstance(gcs_raw, bool) else None,
        tray_show_feedback=tsf_raw if isinstance(tsf_raw, bool) else None,
        tray_show_assistant=tsa_raw if isinstance(tsa_raw, bool) else None,
        music_playlists=music_playlists,
        visual_style_presets=visual_style_presets,
        ewa_hints=ewa_hints,
    )


SHELL_STATE_FIELD_ETAGS_HEADER = "X-Shell-State-Field-ETags"
SHELL_STATE_IF_MATCH_FIELDS_HEADER = "X-Shell-State-If-Match-Fields"


def _shell_state_field_etags(payload: DesktopShellStateOut) -> dict[str, str]:
    dumped = payload.model_dump(mode="json")
    return {key: f'"{_stable_json_digest(value)}"' for key, value in dumped.items()}


def _set_shell_state_etag_headers(response: Response, payload: DesktopShellStateOut) -> str:
    etag = _weak_etag_for_pydantic_model(payload)
    response.headers["ETag"] = etag
    response.headers[SHELL_STATE_FIELD_ETAGS_HEADER] = json.dumps(
        _shell_state_field_etags(payload),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    )
    return etag


def _parse_shell_state_field_etags_header(raw: str | None) -> dict[str, str]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    if not isinstance(parsed, dict):
        return {}
    out: dict[str, str] = {}
    for key, value in parsed.items():
        if isinstance(key, str) and isinstance(value, str) and key:
            out[key] = value
    return out


def _shell_state_patch_keys(patch: dict[str, Any]) -> set[str]:
    return {key for key, value in patch.items() if value is not None}


def _raise_if_shell_state_etag_conflict(
    if_match: str | None,
    current_etag: str,
    *,
    current_field_etags: dict[str, str] | None = None,
    patch_keys: set[str] | None = None,
    if_match_fields: str | None = None,
) -> None:
    if if_match and not _if_none_match_matches(if_match, current_etag):
        field_etags = current_field_etags or {}
        keys = patch_keys or set()
        provided_field_etags = _parse_shell_state_field_etags_header(if_match_fields)
        if keys and provided_field_etags:
            disjoint_from_current_changes = all(provided_field_etags.get(key) == field_etags.get(key) for key in keys)
            if disjoint_from_current_changes:
                return
        raise HTTPException(
            status_code=status.HTTP_412_PRECONDITION_FAILED,
            detail={
                "code": "desktop_shell_state_conflict",
                "message": "Desktop shell state changed in another session",
                "current_etag": current_etag,
                "current_field_etags": field_etags,
            },
        )


async def _lock_desktop_config_row_for_update(db: AsyncSession, user_id: UUID) -> DesktopConfig:
    """Ensure row exists, then ``SELECT … FOR UPDATE`` before shell_state merge (P2)."""
    await _get_or_create_desktop_config_row(db, user_id)
    result = await db.execute(select(DesktopConfig).where(DesktopConfig.user_id == user_id).with_for_update())
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="desktop config row missing after create",
        )
    return config


@router.get(
    "/shell-state",
    response_model=DesktopShellStateOut,
    responses={304: {"description": "Not Modified — If-None-Match matched ETag."}},
)
async def get_shell_state(
    request: Request,
    response: Response,
    current_user: AuthUser = Depends(require_oauth2_user),
    user_id: UUID = Depends(_get_desktop_user_id),
    db: AsyncSession = Depends(get_postgres_session),
):
    """Ephemeral desktop shell state (MRU apps, virtual desktops, window snapshot, …)."""
    from api.routers import desktop_shell_config as sc

    _ = current_user
    config = await sc._get_or_create_desktop_config_row(db, user_id)
    raw = getattr(config, "shell_state", None)
    out = _shell_state_to_out(_normalize_shell_state(raw))
    etag = sc._set_shell_state_etag_headers(response, out)
    if _if_none_match_matches(request.headers.get("if-none-match"), etag):
        observe_desktop_shell_state_get_304()
        return Response(
            status_code=status.HTTP_304_NOT_MODIFIED,
            headers={
                "ETag": etag,
                SHELL_STATE_FIELD_ETAGS_HEADER: response.headers[SHELL_STATE_FIELD_ETAGS_HEADER],
            },
        )
    return out


@router.patch("/shell-state", response_model=DesktopShellStateOut)
async def patch_shell_state(
    data: DesktopShellStatePatch,
    request: Request,
    response: Response,
    current_user: AuthUser = Depends(require_oauth2_user),
    user_id: UUID = Depends(_get_desktop_user_id),
    db: AsyncSession = Depends(get_postgres_session),
    idempotency_key_header: str | None = Header(default=None, alias="Idempotency-Key"),
):
    """Merge partial shell state into stored JSON (top-level keys replaced when present).

    P2: locks ``desktop_configs`` with ``FOR UPDATE``. Optional ``Idempotency-Key``
    (8–128) uses Redis replay; when the header is present and Redis is down → 503
    fail-closed. Absent key keeps legacy clients / keepalive working.
    """
    from api.routers import desktop_shell_config as sc

    _ = current_user
    started = time.perf_counter()
    result_label = "error"
    idem_raw = sc.normalize_shell_state_idempotency_key(
        idempotency_key_header or request.headers.get("Idempotency-Key") or request.headers.get("X-Idempotency-Key")
    )
    claimed = False
    try:
        if idem_raw:
            try:
                cached = await sc.get_shell_state_idempotent_response(user_id, idem_raw)
            except ShellStateInProgressError as exc:
                result_label = "in_progress_409"
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="shell-state with this Idempotency-Key is already in progress",
                ) from exc
            except ShellStateRedisUnavailableError as exc:
                result_label = "redis_unavailable"
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="shell-state idempotency store unavailable; retry with same Idempotency-Key",
                ) from exc
            if cached is not None:
                out = DesktopShellStateOut.model_validate(cached)
                sc._set_shell_state_etag_headers(response, out)
                result_label = "idempotent_replay"
                return out

            try:
                claimed = await sc.claim_shell_state_idempotency_key(user_id, idem_raw)
            except ShellStateRedisUnavailableError as exc:
                result_label = "redis_unavailable"
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="shell-state idempotency store unavailable; retry with same Idempotency-Key",
                ) from exc
            if not claimed:
                try:
                    cached_again = await sc.get_shell_state_idempotent_response(user_id, idem_raw)
                except ShellStateInProgressError as exc:
                    result_label = "in_progress_409"
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="shell-state with this Idempotency-Key is already in progress",
                    ) from exc
                except ShellStateRedisUnavailableError as exc:
                    result_label = "redis_unavailable"
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="shell-state idempotency store unavailable; retry with same Idempotency-Key",
                    ) from exc
                if cached_again is not None:
                    out = DesktopShellStateOut.model_validate(cached_again)
                    sc._set_shell_state_etag_headers(response, out)
                    result_label = "idempotent_replay"
                    return out
                result_label = "in_progress_409"
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="shell-state with this Idempotency-Key is already in progress",
                )

        config = await sc._lock_desktop_config_row_for_update(db, user_id)
        current = _normalize_shell_state(getattr(config, "shell_state", None))
        current_out = _shell_state_to_out(current)
        current_etag = _weak_etag_for_pydantic_model(current_out)
        patch = data.model_dump(exclude_unset=True)
        _raise_if_shell_state_etag_conflict(
            request.headers.get("if-match"),
            current_etag,
            current_field_etags=_shell_state_field_etags(current_out),
            patch_keys=_shell_state_patch_keys(patch),
            if_match_fields=request.headers.get(SHELL_STATE_IF_MATCH_FIELDS_HEADER),
        )
        for key, value in patch.items():
            if value is None:
                continue
            current[key] = value
        _persist_shell_state_sanitized_fields(current)
        cfg_shell: Any = config
        cfg_shell.shell_state = current
        sc.flag_modified(config, "shell_state")
        await db.commit()
        await db.refresh(config)
        out = _shell_state_to_out(current)
        sc._set_shell_state_etag_headers(response, out)
        if idem_raw and claimed:
            await sc.remember_shell_state_idempotent_response(user_id, idem_raw, out.model_dump(mode="json"))
        result_label = "ok"
        return out
    except HTTPException as exc:
        if idem_raw and claimed:
            await sc.release_shell_state_idempotency_claim(user_id, idem_raw)
        if exc.status_code == status.HTTP_412_PRECONDITION_FAILED:
            result_label = "conflict_412"
        raise
    except Exception:
        if idem_raw and claimed:
            await sc.release_shell_state_idempotency_claim(user_id, idem_raw)
        result_label = "error"
        raise
    finally:
        observe_desktop_shell_state_patch(
            result=result_label,
            duration_seconds=time.perf_counter() - started,
        )
