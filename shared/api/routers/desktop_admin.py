# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# Desktop App Store admin API: catalog CRUD, access groups, user directory, SSO session overview.
# Invariants:
# - Маршруты и авторизация соблюдают require_admin_user.
# Related:
# - api/main.py
# - api/routers/desktop_admin_ai_chat.py
# ---
"""
Desktop App Store admin API: catalog CRUD, access groups CRUD, user access group assignment.
All endpoints require admin role.
"""

import logging
from decimal import Decimal
from typing import Any, Literal, cast
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from api.core.auth import User as AuthUser
from api.core.database_manager import get_asyncpg_pool, get_postgres_session
from api.gaf_chat.system_notifications import notify_user_energy_credits_changed
from api.models.database_models import User as DBUser
from api.models.desktop import AppAccessGroup, DesktopAppCatalog, desktop_app_catalog_access_groups
from api.routers.admin_auth import require_admin_user
from api.routers.desktop import validate_window_instance_policy
from api.routers.desktop_admin_schemas import (
    AccessGroupCreate,
    AccessGroupResponse,
    AccessGroupUpdate,
    AdminSsoLoginHistoryEntry,
    AdminSsoSessionSnapshot,
    AdminUserDirectoryEntry,
    AdminUserDirectoryPage,
    AdminUserDirectorySummary,
    AdminUserSsoOverview,
    CatalogAppCreate,
    CatalogAppResponse,
    CatalogAppUpdate,
    UserAppAccessGroupResponse,
    UserAppAccessGroupUpdate,
    UserEwBalanceSetBody,
    UserUgsCreditsSetBody,
    UserWebSearchQuotaPatch,
    WebSearchQuotaStatusResponse,
    validate_factory_catalog_flags,
)
from api.routers.desktop_store import DesktopAccessGroupRef
from api.services.sso_session_registry import batch_sso_sessions_for_user_ids, list_sso_login_history_for_user
from api.services.web_search_quota_service import admin_patch_web_search_quota, get_web_search_quota_status

router = APIRouter(prefix="/desktop/admin", tags=["desktop-admin"])

logger = logging.getLogger(__name__)


async def _sync_catalog_access_groups(
    db: AsyncSession,
    app: DesktopAppCatalog,
    group_ids: list[UUID],
) -> None:
    """Replace catalog app access groups (empty list = visible to all user groups)."""
    ordered = list(dict.fromkeys(group_ids))
    if not ordered:
        app.access_groups = []
        await db.flush()
        return
    result = await db.execute(select(AppAccessGroup).where(AppAccessGroup.id.in_(ordered)))
    found = {cast(UUID, g.id): g for g in result.scalars().all()}
    missing = set(ordered) - set(found.keys())
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown access group id(s): {sorted(str(x) for x in missing)}",
        )
    app.access_groups = [found[i] for i in ordered]
    await db.flush()


def _catalog_to_response(app: DesktopAppCatalog) -> CatalogAppResponse:
    allow_multiple_windows = bool(getattr(app, "allow_multiple_windows", False))
    max_window_instances = int(getattr(app, "max_window_instances", 1) or 1)
    return CatalogAppResponse(
        id=app.id,
        app_id=app.app_id,
        name=app.name,
        description=app.description,
        app_component=app.app_component,
        category=app.category,
        gradient=app.gradient,
        color=app.color,
        sort_order=app.sort_order,
        allow_multiple_windows=allow_multiple_windows,
        max_window_instances=max_window_instances if allow_multiple_windows else 1,
        is_system=getattr(app, "is_system", False),
        is_factory=getattr(app, "is_factory", False),
        ew_monthly_price=int(getattr(app, "ew_monthly_price", 0) or 0),
        trial_duration_days=int(getattr(app, "trial_duration_days", 0) or 0),
        is_featured_new=bool(getattr(app, "is_featured_new", False)),
        new_until=getattr(app, "new_until", None),
        maintenance_mode=bool(getattr(app, "maintenance_mode", False)),
        maintenance_title=getattr(app, "maintenance_title", None),
        maintenance_reason=getattr(app, "maintenance_reason", None),
        maintenance_expected_outcome=getattr(app, "maintenance_expected_outcome", None),
        maintenance_eta_note=getattr(app, "maintenance_eta_note", None),
        icon_url=getattr(app, "icon_url", None),
        icon_url_2x=getattr(app, "icon_url_2x", None),
        preview_url=getattr(app, "preview_url", None),
        preview_url_2x=getattr(app, "preview_url_2x", None),
        access_groups=[DesktopAccessGroupRef.model_validate(g) for g in app.access_groups],
        created_at=app.created_at,
        updated_at=app.updated_at,
    )


# ============= Catalog CRUD =============


@router.get("/catalog", response_model=list[CatalogAppResponse])
async def admin_list_catalog(
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
):
    """List all catalog apps (admin)."""
    result = await db.execute(
        select(DesktopAppCatalog)
        .options(selectinload(DesktopAppCatalog.access_groups))
        .order_by(DesktopAppCatalog.sort_order, DesktopAppCatalog.name)
    )
    rows = result.scalars().all()
    return [_catalog_to_response(c) for c in rows]


@router.post("/catalog", response_model=CatalogAppResponse)
async def admin_create_catalog_app(
    data: CatalogAppCreate,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
):
    """Create a catalog app (admin)."""
    existing = await db.execute(select(DesktopAppCatalog).where(DesktopAppCatalog.app_id == data.app_id))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="App id already exists",
        )
    validate_factory_catalog_flags(
        is_factory=data.is_factory,
        is_system=data.is_system,
        ew_monthly_price=data.ew_monthly_price,
        trial_duration_days=data.trial_duration_days,
    )
    validate_window_instance_policy(
        allow_multiple_windows=data.allow_multiple_windows,
        max_window_instances=(data.max_window_instances if data.allow_multiple_windows else 1),
    )
    app = DesktopAppCatalog(
        app_id=data.app_id,
        name=data.name,
        description=data.description,
        app_component=data.app_component,
        category=data.category,
        gradient=data.gradient,
        color=data.color,
        sort_order=data.sort_order,
        allow_multiple_windows=data.allow_multiple_windows,
        max_window_instances=(data.max_window_instances if data.allow_multiple_windows else 1),
        is_system=data.is_system,
        is_factory=data.is_factory,
        ew_monthly_price=data.ew_monthly_price,
        trial_duration_days=data.trial_duration_days,
        is_featured_new=data.is_featured_new,
        new_until=data.new_until,
        maintenance_mode=data.maintenance_mode,
        maintenance_title=data.maintenance_title,
        maintenance_reason=data.maintenance_reason,
        maintenance_expected_outcome=data.maintenance_expected_outcome,
        maintenance_eta_note=data.maintenance_eta_note,
        icon_url=data.icon_url,
        icon_url_2x=data.icon_url_2x,
        preview_url=data.preview_url,
        preview_url_2x=data.preview_url_2x,
    )
    db.add(app)
    await db.flush()
    await _sync_catalog_access_groups(db, app, list(data.access_group_ids))
    await db.commit()
    reload = await db.execute(
        select(DesktopAppCatalog)
        .options(selectinload(DesktopAppCatalog.access_groups))
        .where(DesktopAppCatalog.id == app.id)
    )
    return _catalog_to_response(reload.scalar_one())


@router.get("/catalog/{app_id}", response_model=CatalogAppResponse)
async def admin_get_catalog_app(
    app_id: str,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
):
    """Get one catalog app by app_id (admin)."""
    result = await db.execute(
        select(DesktopAppCatalog)
        .options(selectinload(DesktopAppCatalog.access_groups))
        .where(DesktopAppCatalog.app_id == app_id)
    )
    app = result.scalar_one_or_none()
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    return _catalog_to_response(app)


@router.patch("/catalog/{app_id}", response_model=CatalogAppResponse)
async def admin_update_catalog_app(
    app_id: str,
    data: CatalogAppUpdate,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
):
    """Update a catalog app (admin)."""
    result = await db.execute(
        select(DesktopAppCatalog)
        .options(selectinload(DesktopAppCatalog.access_groups))
        .where(DesktopAppCatalog.app_id == app_id)
    )
    app = result.scalar_one_or_none()
    if app is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="App not found")
    payload = data.model_dump(exclude_unset=True)
    group_ids_to_set: list[UUID] | None = None
    if "access_group_ids" in payload:
        group_ids_to_set = list(payload.pop("access_group_ids") or [])
    for k, v in payload.items():
        setattr(app, k, v)
    if not bool(getattr(app, "allow_multiple_windows", False)):
        app.max_window_instances = 1  # type: ignore[assignment]
    if group_ids_to_set is not None:
        await _sync_catalog_access_groups(db, app, group_ids_to_set)
    allow_multiple_windows = bool(getattr(app, "allow_multiple_windows", False))
    max_window_instances = int(getattr(app, "max_window_instances", 1) or 1)
    validate_factory_catalog_flags(
        is_factory=bool(getattr(app, "is_factory", False)),
        is_system=bool(getattr(app, "is_system", False)),
        ew_monthly_price=int(getattr(app, "ew_monthly_price", 0) or 0),
        trial_duration_days=int(getattr(app, "trial_duration_days", 0) or 0),
    )
    validate_window_instance_policy(
        allow_multiple_windows=allow_multiple_windows,
        max_window_instances=max_window_instances,
    )
    await db.commit()
    reload = await db.execute(
        select(DesktopAppCatalog)
        .options(selectinload(DesktopAppCatalog.access_groups))
        .where(DesktopAppCatalog.id == app.id)
    )
    return _catalog_to_response(reload.scalar_one())


@router.delete("/catalog/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_catalog_app(
    app_id: str,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
):
    """Delete a catalog app (admin)."""
    result = await db.execute(select(DesktopAppCatalog).where(DesktopAppCatalog.app_id == app_id))
    app = result.scalar_one_or_none()
    if app is None:
        return
    await db.delete(app)
    await db.commit()


# ============= Access groups CRUD =============


@router.get("/access-groups", response_model=list[AccessGroupResponse])
async def admin_list_access_groups(
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
):
    """List all app access groups (admin)."""
    result = await db.execute(select(AppAccessGroup).order_by(AppAccessGroup.name))
    return result.scalars().all()


@router.post("/access-groups", response_model=AccessGroupResponse)
async def admin_create_access_group(
    data: AccessGroupCreate,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
):
    """Create an access group (admin)."""
    group = AppAccessGroup(name=data.name, description=data.description)
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group


@router.get("/access-groups/{group_id}", response_model=AccessGroupResponse)
async def admin_get_access_group(
    group_id: UUID,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
):
    """Get one access group (admin)."""
    result = await db.execute(select(AppAccessGroup).where(AppAccessGroup.id == group_id))
    group = result.scalar_one_or_none()
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    return group


@router.patch("/access-groups/{group_id}", response_model=AccessGroupResponse)
async def admin_update_access_group(
    group_id: UUID,
    data: AccessGroupUpdate,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
):
    """Update an access group (admin)."""
    result = await db.execute(select(AppAccessGroup).where(AppAccessGroup.id == group_id))
    group = result.scalar_one_or_none()
    if group is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Group not found")
    group_mut: Any = group
    if data.name is not None:
        group_mut.name = data.name
    if data.description is not None:
        group_mut.description = data.description
    await db.commit()
    await db.refresh(group)
    return group


@router.delete("/access-groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_access_group(
    group_id: UUID,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
):
    """Delete an access group if no users or catalog apps reference it (admin)."""
    result = await db.execute(select(AppAccessGroup).where(AppAccessGroup.id == group_id))
    group = result.scalar_one_or_none()
    if group is None:
        return
    users_count = await db.execute(
        select(func.count()).select_from(DBUser).where(DBUser.app_access_group_id == group_id)
    )
    if (users_count.scalar() or 0) > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete group: users are assigned to it",
        )
    catalog_count = await db.execute(
        select(func.count())
        .select_from(desktop_app_catalog_access_groups)
        .where(desktop_app_catalog_access_groups.c.access_group_id == group_id)
    )
    if (catalog_count.scalar() or 0) > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete group: catalog apps reference it",
        )
    await db.delete(group)
    await db.commit()


# ============= Users: list and set access group =============


def _ugs_credits_from_user(user: DBUser) -> float:
    cr = getattr(user, "credits", None)
    if cr is None:
        return 0.0
    return float(cr)


def _user_app_access_row(user: DBUser) -> UserAppAccessGroupResponse:
    return UserAppAccessGroupResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        role=user.role,
        ugs_credits=_ugs_credits_from_user(user),
        ew_balance=int(getattr(user, "ew_balance", 100) or 100),
        app_access_group_id=getattr(user, "app_access_group_id", None),
        app_access_group_name=user.app_access_group.name if user.app_access_group else None,
    )


@router.get("/users", response_model=list[UserAppAccessGroupResponse])
async def admin_list_users_app_access(
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
):
    """List users with their app access group (admin)."""
    result = await db.execute(select(DBUser).options(selectinload(DBUser.app_access_group)).order_by(DBUser.username))
    users = result.scalars().all()
    return [_user_app_access_row(u) for u in users]


@router.get("/users/directory", response_model=AdminUserDirectoryPage)
async def admin_users_directory(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    search: str | None = None,
    role: str | None = None,
    is_active: bool | None = None,
    is_trusted: bool | None = None,
    is_verified: bool | None = None,
    online_only: bool = Query(False, description="Только пользователи с живым presence (Redis)"),
    app_access_group_id: str | None = Query(
        None,
        description="UUID группы магазина; ``__none__`` — только без группы",
    ),
    presence_anomaly_only: bool = Query(
        False,
        description="Только пользователи с >1 живой browser Socket.IO сессией (Redis)",
    ),
    sso_browser_active_only: bool = Query(
        False,
        description="Только пользователи с активной SSO browser-сессией (Postgres registry)",
    ),
    sso_mobile_active_only: bool = Query(
        False,
        description="Только пользователи с активной SSO mobile-сессией (Postgres registry)",
    ),
    sso_desktop_active_only: bool = Query(
        False,
        description="Только пользователи с активной SSO desktop-сессией (Postgres registry)",
    ),
    sso_fofline_active_only: bool = Query(
        False,
        description="Только пользователи с активной SSO FoFline-сессией (Postgres registry)",
    ),
    channel_mismatch_only: bool = Query(
        False,
        description="Только пользователи с рассинхроном SSO browser и Socket.IO (heuristic)",
    ),
    sort_by: str | None = Query(
        "created_at",
        description="Поле сортировки: created_at, last_login_at, username, email, ew_balance",
    ),
    sort_dir: str | None = Query("desc", description="asc или desc"),
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> AdminUserDirectoryPage:
    """Постраничный каталог пользователей (профиль, даты, группа магазина, presence)."""
    from api.services.admin_users_directory import (
        apply_directory_sql_filters,
        count_directory_sso_active_matching,
        count_directory_subset,
        directory_channel_mismatch_matching_ids,
        directory_order_by,
        directory_sso_active_exists,
        directory_uuid_list_from_strings,
    )
    from api.services.presence_service import (
        batch_presence_for_user_ids,
        get_online_presence_user_ids,
        get_presence_anomaly_user_ids,
    )

    redis_ok_o, online_ids = await get_online_presence_user_ids()
    redis_ok_a, anomaly_ids = await get_presence_anomaly_user_ids()
    redis_ok_early = redis_ok_o and redis_ok_a

    redis_presence_filter: set[str] | None = None
    if online_only:
        redis_presence_filter = set(online_ids)
    if presence_anomaly_only:
        if redis_presence_filter is not None:
            redis_presence_filter &= anomaly_ids
        else:
            redis_presence_filter = set(anomaly_ids)

    try:
        base, count_q = apply_directory_sql_filters(
            search=search,
            role=role,
            app_access_group_id=app_access_group_id,
            is_active=is_active,
            is_trusted=is_trusted,
            is_verified=is_verified,
        )
    except ValueError as exc:
        if "app_access_group_id" in str(exc):
            raise HTTPException(status_code=400, detail="Invalid app_access_group_id") from exc
        raise

    online_match: int | None = None
    anomaly_match: int | None = None
    if redis_ok_o and redis_ok_a:
        online_match = await count_directory_subset(
            db,
            count_q,
            directory_uuid_list_from_strings(online_ids),
        )
        anomaly_match = await count_directory_subset(
            db,
            count_q,
            directory_uuid_list_from_strings(anomaly_ids),
        )

    channel_mismatch_match: int | None = None
    redis_ok_cm = True
    mismatch_ids: set[str] = set()
    if redis_ok_o:
        redis_ok_cm, mismatch_ids = await directory_channel_mismatch_matching_ids(db, count_q)
        if redis_ok_cm:
            channel_mismatch_match = await count_directory_subset(
                db,
                count_q,
                directory_uuid_list_from_strings(mismatch_ids),
            )

    summary = AdminUserDirectorySummary(
        online_matching_total=online_match,
        presence_anomaly_matching_total=anomaly_match,
        sso_browser_active_matching_total=await count_directory_sso_active_matching(db, count_q, "browser"),
        sso_mobile_active_matching_total=await count_directory_sso_active_matching(db, count_q, "mobile"),
        sso_desktop_active_matching_total=await count_directory_sso_active_matching(db, count_q, "desktop"),
        sso_fofline_active_matching_total=await count_directory_sso_active_matching(db, count_q, "fofline"),
        channel_mismatch_matching_total=channel_mismatch_match if redis_ok_cm else None,
    )

    if sso_browser_active_only:
        sso_b = directory_sso_active_exists("browser")
        base = base.where(sso_b)
        count_q = count_q.where(sso_b)
    if sso_mobile_active_only:
        sso_m = directory_sso_active_exists("mobile")
        base = base.where(sso_m)
        count_q = count_q.where(sso_m)
    if sso_desktop_active_only:
        sso_d = directory_sso_active_exists("desktop")
        base = base.where(sso_d)
        count_q = count_q.where(sso_d)
    if sso_fofline_active_only:
        sso_f = directory_sso_active_exists("fofline")
        base = base.where(sso_f)
        count_q = count_q.where(sso_f)

    if channel_mismatch_only:
        if not redis_ok_cm:
            return AdminUserDirectoryPage(
                redis_available=False,
                total=0,
                page=page,
                per_page=per_page,
                users=[],
                summary=summary,
            )
        uuid_mismatch = directory_uuid_list_from_strings(mismatch_ids)
        if not uuid_mismatch:
            return AdminUserDirectoryPage(
                redis_available=True,
                total=0,
                page=page,
                per_page=per_page,
                users=[],
                summary=summary,
            )
        mismatch_filter = DBUser.id.in_(uuid_mismatch)
        base = base.where(mismatch_filter)
        count_q = count_q.where(mismatch_filter)

    if online_only or presence_anomaly_only:
        if not redis_ok_early:
            return AdminUserDirectoryPage(
                redis_available=False,
                total=0,
                page=page,
                per_page=per_page,
                users=[],
                summary=None,
            )
        uuid_online = directory_uuid_list_from_strings(redis_presence_filter or set())
        if not uuid_online:
            return AdminUserDirectoryPage(
                redis_available=True,
                total=0,
                page=page,
                per_page=per_page,
                users=[],
                summary=summary,
            )
        online_filter = DBUser.id.in_(uuid_online)
        base = base.where(online_filter)
        count_q = count_q.where(online_filter)

    total = int((await db.execute(count_q)).scalar() or 0)
    offset = (page - 1) * per_page
    order = directory_order_by(sort_by, sort_dir)
    result = await db.execute(base.order_by(order).offset(offset).limit(per_page))
    rows = result.scalars().all()
    id_list = [str(u.id) for u in rows]
    redis_ok, presence_map = await batch_presence_for_user_ids(id_list)
    sso_map = await batch_sso_sessions_for_user_ids(id_list)
    from api.services.desktop_client.admin_directory_enrich import (
        batch_desktop_client_enrich_for_user_ids,
    )

    desk_map = await batch_desktop_client_enrich_for_user_ids(id_list)

    out: list[AdminUserDirectoryEntry] = []
    for u in rows:
        uid = str(u.id)
        pr = presence_map.get(uid, {})
        sso = sso_map.get(uid, {})
        browser = sso.get("browser") or {}
        mobile = sso.get("mobile") or {}
        desktop = sso.get("desktop") or {}
        fofline = sso.get("fofline") or {}
        desk = desk_map.get(uid) or {}
        out.append(
            AdminUserDirectoryEntry(
                id=u.id,
                username=u.username,
                email=u.email,
                role=u.role,
                full_name=u.full_name,
                avatar_url=u.avatar_url,
                is_active=bool(u.is_active),
                is_verified=bool(u.is_verified),
                is_trusted=bool(getattr(u, "is_trusted", False)),
                created_at=u.created_at,
                updated_at=u.updated_at,
                last_login_at=u.last_login_at,
                login_count=int(getattr(u, "login_count", 0) or 0),
                ugs_credits=_ugs_credits_from_user(u),
                ew_balance=int(getattr(u, "ew_balance", 100) or 100),
                app_access_group_id=getattr(u, "app_access_group_id", None),
                app_access_group_name=u.app_access_group.name if u.app_access_group else None,
                presence_online=bool(pr.get("online")),
                presence_sessions=int(pr.get("sessions") or 0),
                presence_sessions_web=int(pr.get("sessions_web") or 0),
                presence_sessions_mobile=int(pr.get("sessions_mobile") or 0),
                presence_connected_at=pr.get("connected_at"),
                presence_last_seen_at=pr.get("last_seen_at"),
                sso_browser_active=bool(browser.get("active")),
                sso_mobile_active=bool(mobile.get("active")),
                sso_desktop_active=bool(desktop.get("active")),
                sso_fofline_active=bool(fofline.get("active")),
                sso_browser_live=bool(browser.get("live")),
                sso_mobile_live=bool(mobile.get("live")),
                sso_desktop_live=bool(desktop.get("live")),
                sso_fofline_live=bool(fofline.get("live")),
                sso_browser_client_id=browser.get("client_id"),
                sso_mobile_client_id=mobile.get("client_id"),
                sso_desktop_client_id=desktop.get("client_id"),
                sso_fofline_client_id=fofline.get("client_id"),
                sso_browser_last_seen_at=browser.get("last_seen_at"),
                sso_mobile_last_seen_at=mobile.get("last_seen_at"),
                sso_desktop_last_seen_at=desktop.get("last_seen_at"),
                sso_fofline_last_seen_at=fofline.get("last_seen_at"),
                sso_browser_ip=browser.get("ip_address"),
                sso_mobile_ip=mobile.get("ip_address"),
                sso_desktop_ip=desktop.get("ip_address"),
                sso_fofline_ip=fofline.get("ip_address"),
                sso_browser_user_agent=browser.get("user_agent"),
                sso_mobile_user_agent=mobile.get("user_agent"),
                sso_desktop_user_agent=desktop.get("user_agent"),
                sso_fofline_user_agent=fofline.get("user_agent"),
                desktop_license_id=desk.get("desktop_license_id"),
                desktop_license_label=desk.get("desktop_license_label"),
                desktop_license_mode=desk.get("desktop_license_mode"),
                desktop_license_status=desk.get("desktop_license_status"),
                desktop_peer_slug=desk.get("desktop_peer_slug"),
                desktop_peer_status=desk.get("desktop_peer_status"),
                desktop_peer_assigned_ip=desk.get("desktop_peer_assigned_ip"),
                desktop_app_version=desk.get("desktop_app_version"),
                desktop_wg_up=desk.get("desktop_wg_up"),
                desktop_build_channel=desk.get("desktop_build_channel"),
                desktop_updater_pubkey_baked=desk.get("desktop_updater_pubkey_baked"),
                desktop_report_ip=desk.get("desktop_report_ip"),
                desktop_reported_at=desk.get("desktop_reported_at"),
            )
        )

    return AdminUserDirectoryPage(
        redis_available=redis_ok,
        total=total,
        page=page,
        per_page=per_page,
        users=out,
        summary=summary,
    )


@router.get("/users/{user_id}/sso-overview", response_model=AdminUserSsoOverview)
async def admin_user_sso_overview(
    user_id: UUID,
    history_limit: int = Query(50, ge=1, le=200, description="Сколько последних SSO-событий вернуть"),
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> AdminUserSsoOverview:
    """Текущие SSO-сессии (browser/mobile/desktop) и история входов пользователя."""
    uid = str(user_id)
    exists = await db.execute(select(DBUser.id).where(DBUser.id == user_id))
    if exists.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    sso_map = await batch_sso_sessions_for_user_ids([uid])
    bucket = sso_map.get(uid, {})
    sessions: list[AdminSsoSessionSnapshot] = []
    for client_class in ("browser", "mobile", "desktop", "fofline"):
        row = bucket.get(client_class)
        if not row:
            continue
        sessions.append(AdminSsoSessionSnapshot(**row))

    raw_history = await list_sso_login_history_for_user(uid, limit=history_limit)
    history = [AdminSsoLoginHistoryEntry(**item) for item in raw_history]

    return AdminUserSsoOverview(user_id=user_id, sessions=sessions, history=history)


@router.patch("/users/{user_id}", response_model=UserAppAccessGroupResponse)
async def admin_update_user_app_access_group(
    user_id: UUID,
    data: UserAppAccessGroupUpdate,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
):
    """Set a user's app access group (admin)."""
    result = await db.execute(select(DBUser).options(selectinload(DBUser.app_access_group)).where(DBUser.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not hasattr(user, "app_access_group_id"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User model has no app_access_group_id",
        )
    user_mut: Any = user
    user_mut.app_access_group_id = data.app_access_group_id
    await db.commit()
    await db.refresh(user)
    return _user_app_access_row(user)


@router.patch("/users/{user_id}/ugs-credits", response_model=UserAppAccessGroupResponse)
async def admin_set_user_ugs_credits(
    user_id: UUID,
    data: UserUgsCreditsSetBody,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
    db_pool: Any = Depends(get_asyncpg_pool),
):
    """Set UGS generation credits (absolute value; separate from EW desktop store balance)."""
    result = await db.execute(select(DBUser).options(selectinload(DBUser.app_access_group)).where(DBUser.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not hasattr(user, "credits"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User model has no credits",
        )
    old_bal = _ugs_credits_from_user(user)
    user_mut: Any = user
    user_mut.credits = Decimal(str(round(data.ugs_credits, 2)))
    await db.commit()
    await db.refresh(user)
    new_bal = _ugs_credits_from_user(user)
    if abs(new_bal - old_bal) > 1e-6:
        await notify_user_energy_credits_changed(
            db_pool,
            str(user.id),
            new_balance=new_bal,
            delta=new_bal - old_bal,
        )
    return _user_app_access_row(user)


def _web_search_quota_response(status) -> WebSearchQuotaStatusResponse:
    return WebSearchQuotaStatusResponse(
        user_id=UUID(status.user_id),
        monthly_limit=status.monthly_limit,
        monthly_used=status.monthly_used,
        monthly_remaining=status.monthly_remaining,
        coins=status.coins,
        total_remaining=status.total_remaining,
        period_month=status.period_month.isoformat(),
    )


@router.get("/users/{user_id}/web-search-quota", response_model=WebSearchQuotaStatusResponse)
async def admin_get_user_web_search_quota(
    user_id: UUID,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
):
    """Current-month web search quota for a user (admin)."""
    quota = await get_web_search_quota_status(db, user_id)
    if quota is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _web_search_quota_response(quota)


@router.patch("/users/{user_id}/web-search-quota", response_model=WebSearchQuotaStatusResponse)
async def admin_patch_user_web_search_quota(
    user_id: UUID,
    data: UserWebSearchQuotaPatch,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
):
    """Set coins, add coins delta, or override monthly free search limit (admin)."""
    if (
        data.web_search_coins is None
        and data.web_search_coins_delta is None
        and data.web_search_monthly_limit is None
        and not data.reset_monthly_limit
    ):
        raise HTTPException(status_code=400, detail="No quota fields to update")
    try:
        status = await admin_patch_web_search_quota(
            db,
            user_id,
            web_search_coins=data.web_search_coins,
            web_search_coins_delta=data.web_search_coins_delta,
            web_search_monthly_limit=data.web_search_monthly_limit,
            reset_monthly_limit=data.reset_monthly_limit,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return _web_search_quota_response(status)


@router.patch("/users/{user_id}/ew-balance", response_model=UserAppAccessGroupResponse)
async def admin_set_user_ew_balance(
    user_id: UUID,
    data: UserEwBalanceSetBody,
    _admin: AuthUser = Depends(require_admin_user),
    db: AsyncSession = Depends(get_postgres_session),
):
    """Set a user's EW balance (desktop store only; does not affect UGS)."""
    result = await db.execute(select(DBUser).options(selectinload(DBUser.app_access_group)).where(DBUser.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not hasattr(user, "ew_balance"):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User model has no ew_balance",
        )
    user_mut: Any = user
    user_mut.ew_balance = data.ew_balance
    await db.commit()
    await db.refresh(user)
    return _user_app_access_row(user)


@router.get("/presence/online")
async def admin_presence_online(
    _admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    """Пользователи с активным Socket.IO (см. presence_service + socketio_handler)."""
    from api.services.presence_service import enrich_presence_users_from_database, list_online

    payload = await list_online()
    users = payload.get("users")
    if isinstance(users, list) and users:
        payload["users"] = await enrich_presence_users_from_database(users)
        payload["total"] = len(payload["users"])
    return payload


class PresenceUserCommandBody(BaseModel):
    user_id: str = Field(..., min_length=1, max_length=512)
    action: Literal["logout", "reload"]


async def _presence_command_targets_self_logout(admin: AuthUser, target_user_id: str, action: str) -> bool:
    """Запрет принудительного выхода себе (Keycloak sub или users.id)."""
    if action != "logout":
        return False
    tid = str(target_user_id).strip()
    if tid == str(admin.id).strip():
        return True
    pool = await get_asyncpg_pool()
    if not pool:
        return False
    try:
        email = (admin.email or "").strip()
        if not email:
            return False
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT id::text AS id FROM users WHERE lower(email) = lower($1)",
                email,
            )
        if row and str(row["id"]) == tid:
            return True
    except Exception as exc:
        logger.debug("[STEP] desktop_admin_presence_self_logout_lookup_skip err=%s", exc)
        return False
    return False


@router.post("/presence/command")
async def admin_presence_user_command(
    body: PresenceUserCommandBody,
    admin: AuthUser = Depends(require_admin_user),
) -> dict[str, Any]:
    """
    Отправить пользователю команду по Socket.IO: выход (Keycloak logout) или перезагрузка вкладки.
    Доставляется только открытым вкладкам с активным Emperyworld socket.
    """
    from api.routers.socketio_handler import emit_presence_admin_command
    from api.services.admin_presence_audit import insert_presence_command_audit
    from api.services.presence_service import (
        assert_presence_admin_command_rate_limit,
        assert_presence_target_has_active_sessions,
    )

    if await _presence_command_targets_self_logout(admin, body.user_id, body.action):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя завершить свою сессию отсюда — используйте «Выход» в приложении.",
        )
    await assert_presence_admin_command_rate_limit(str(admin.id))
    target_uid = body.user_id.strip()
    await assert_presence_target_has_active_sessions(target_uid)
    delivered = await emit_presence_admin_command(target_uid, body.action)
    await insert_presence_command_audit(
        admin_id=str(admin.id),
        admin_email=admin.email,
        target_user_id=target_uid,
        action=body.action,
        delivered=delivered,
    )
    return {"ok": True, "delivered": delivered}


from api.routers.desktop_admin_ai_chat import router as desktop_admin_ai_chat_router  # noqa: E402
from api.routers.desktop_admin_content_e2e_fixtures import (  # noqa: E402
    router as desktop_admin_content_e2e_fixtures_router,
)
from api.routers.desktop_admin_content_ops import router as desktop_admin_content_ops_router  # noqa: E402
from api.routers.desktop_admin_factory import (  # noqa: E402
    router as desktop_admin_factory_router,
)
from api.routers.desktop_admin_i18n_rewrite import router as desktop_admin_i18n_rewrite_router  # noqa: E402
from api.routers.desktop_admin_platform_ops import (  # noqa: E402
    router as desktop_admin_platform_ops_router,
)
from api.routers.desktop_admin_search_config import router as desktop_admin_search_config_router  # noqa: E402
from api.routers.desktop_admin_shell_telemetry import (  # noqa: E402
    router as desktop_admin_shell_telemetry_router,
)
from api.routers.desktop_admin_topology import (  # noqa: E402
    router as desktop_admin_topology_router,
)
from api.routers.desktop_admin_workers_ops import router as desktop_admin_workers_ops_router  # noqa: E402

router.include_router(desktop_admin_ai_chat_router)
router.include_router(desktop_admin_content_ops_router)
router.include_router(desktop_admin_content_e2e_fixtures_router)
router.include_router(desktop_admin_i18n_rewrite_router)
router.include_router(desktop_admin_search_config_router)
router.include_router(desktop_admin_shell_telemetry_router)
router.include_router(desktop_admin_platform_ops_router)
router.include_router(desktop_admin_topology_router)
router.include_router(desktop_admin_factory_router)
router.include_router(desktop_admin_workers_ops_router)
