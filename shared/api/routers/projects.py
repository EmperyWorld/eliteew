#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   📁💼 PROJECTS API - CRUD operations for projects and team management
# Invariants:
#   - Маршруты и авторизация — как реализовано в модуле; секреты не в исходниках.
# Related:
#   - shared/api/main.py (регистрация роутеров); см. затронутые services/models.
# ------------------------------------------------------------------------------
"""
📁💼 PROJECTS API - CRUD operations for projects and team management
Created: 2025-10-15
Purpose: Full-featured project management with role-based access control
"""

import contextlib
import logging
import uuid
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)  # type: ignore[import-untyped]
from sqlalchemy import String, and_, cast, func, or_, select, text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]
from sqlalchemy.orm.attributes import flag_modified  # type: ignore[import-not-found]

from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.core.user_identity import resolve_db_user_uuid_with_session
from api.models.database_models import (
    Company,
    MemberStatus,
    Project,
    ProjectMember,
    ProjectMemberRole,
    User,
)
from api.schemas.project_schemas import (
    ProjectCreate,
    ProjectMemberCreate,
    ProjectMemberResponse,
    ProjectMembersListResponse,
    ProjectMemberUpdate,
    ProjectResponse,
    ProjectUpdate,
    TransferLeadRequest,
)
from api.services.project_desktop_folder_service import ensure_project_desktop_folder
from api.utils.project_desktop_folder import project_desktop_folder_item_id

logger = logging.getLogger(__name__)
router = APIRouter()

MC_MODULE_PREFIX = "mc_module:"

# Разрешённые суффиксы для mc_module:* (совпадают с ключами enabled_modules проекта).
MC_MODULE_SLUGS_ALLOWED = frozenset(
    {
        "jtbd",
        "value_proposition",
        "swot",
        "competitors",
        "researches",
        "content_ai",
        "context_chat",
        "segments",
        "campaigns",
        "funnel",
        "tasks",
        "alerts",
        "ai_studio",
        "amka",
        "imc",
        "imc_research",
        "client_interaction",
        # Навигация кабинета (Обзор / Компании / Проекты) — выдаётся руководителем участнику
        "cabinet_overview",
        "cabinet_companies",
        "cabinet_projects",
        "__mc_none__",  # явно «ни одного» включённого модуля кабинета (только always-visible на фронте)
    }
)

MC_CABINET_SHELL_ORDER = ("cabinet_overview", "cabinet_companies", "cabinet_projects")
MC_CABINET_SHELL_SLUGS = frozenset(MC_CABINET_SHELL_ORDER)

PROJECT_MEMBER_SPECIAL_PERMISSIONS = frozenset(
    {
        "can_upload_project_vault",
    }
)


def validate_project_member_permissions_list(perms: object) -> list[str]:
    """
    Нормализация и проверка списка прав участника (PUT/POST members).

    Разрешено: can_upload_project_vault; mc_module:<slug> из MC_MODULE_SLUGS_ALLOWED.
    """
    if perms is None:
        return []
    if not isinstance(perms, list):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="permissions must be a list of strings",
        )
    out: list[str] = []
    seen: set[str] = set()
    for raw in perms:
        if not isinstance(raw, str):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Each permission must be a string",
            )
        p = raw.strip()
        if not p or p in seen:
            continue
        if p in PROJECT_MEMBER_SPECIAL_PERMISSIONS:
            out.append(p)
            seen.add(p)
            continue
        if p.startswith(MC_MODULE_PREFIX):
            slug = p[len(MC_MODULE_PREFIX) :].strip()
            if slug not in MC_MODULE_SLUGS_ALLOWED:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unknown marketing cabinet module: mc_module:{slug}",
                )
            token = f"{MC_MODULE_PREFIX}{slug}"
            out.append(token)
            seen.add(token)
            continue
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown permission: {p}",
        )
    return out


def compute_cabinet_modules(
    enabled_modules: list[str] | None,
    *,
    viewer_id: UUID,
    project_created_by: UUID | None,
    company_owner_id: UUID | None,
    member_permissions: list[str] | None,
) -> list[str]:
    """Модули кабинета для viewer: полный набор у руководителя и владельца компании-агента; иначе mc_module:* + разделы cabinet_*."""
    base = list(enabled_modules or [])
    if project_created_by is not None and viewer_id == project_created_by:
        return base
    if company_owner_id is not None and viewer_id == company_owner_id:
        return base
    perms = list(member_permissions or [])
    mods = [p[len(MC_MODULE_PREFIX) :].strip() for p in perms if isinstance(p, str) and p.startswith(MC_MODULE_PREFIX)]
    if not mods:
        return base

    shell_tokens = [s for s in mods if s in MC_CABINET_SHELL_SLUGS]
    has_none = "__mc_none__" in mods
    non_shell = [m for m in mods if m not in MC_CABINET_SHELL_SLUGS and m != "__mc_none__"]

    if has_none:
        content: list[str] = []
    else:
        content = [m for m in base if m in mods]

    if shell_tokens:
        shell_out = list(shell_tokens)
    elif non_shell:
        # Наследие: в правах только контентные mc_module:* — все три раздела навигации
        shell_out = list(MC_CABINET_SHELL_ORDER)
    elif has_none:
        # Только __mc_none__ без cabinet_* — как раньше: контента нет, навигация полная
        shell_out = list(MC_CABINET_SHELL_ORDER)
    else:
        shell_out = []

    shell_ordered = [s for s in MC_CABINET_SHELL_ORDER if s in shell_out]
    content_ordered = [m for m in base if m in content]
    return shell_ordered + content_ordered


def _customer_representative_cabinet_modules(enabled_modules: list[str] | None) -> list[str]:
    """Навигация и контентные модули проекта для представителя заказчика (без правок в UI)."""
    base = list(enabled_modules or [])
    shell_ordered = list(MC_CABINET_SHELL_ORDER)
    content_ordered = [m for m in base if m not in MC_CABINET_SHELL_SLUGS and m != "__mc_none__"]
    return shell_ordered + content_ordered


async def _require_project_lead_for_team(db: AsyncSession, project_id: UUID, user_id: UUID) -> Project:
    result = await db.execute(select(Project).where(Project.id == project_id, Project.deleted_at.is_(None)))
    proj = result.scalar_one_or_none()
    if proj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Проект не найден")
    if proj.created_by is None or proj.created_by != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Только руководитель проекта (создатель) может управлять командой",
        )
    return proj


async def _assert_mutual_friends_sa(db: AsyncSession, user_a: UUID, user_b: UUID) -> None:
    if user_a == user_b:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя добавить себя участником проекта этим способом",
        )
    result = await db.execute(
        text("SELECT check_mutual_friendship(CAST(:a AS uuid), CAST(:b AS uuid)) AS ok"),
        {"a": str(user_a), "b": str(user_b)},
    )
    ok = result.scalar_one()
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Участник должен быть вашим взаимным другом",
        )


async def _project_response_with_cabinet(
    db: AsyncSession,
    project: Project,
    viewer_id: UUID,
) -> ProjectResponse:
    member = await get_project_member(db, project.id, viewer_id, require_active=True)
    cres = await db.execute(select(Company).where(Company.id == project.company_id))
    company = cres.scalar_one_or_none()
    is_customer_rep_only = (
        company is not None
        and company.representative_user_id is not None
        and company.representative_user_id == viewer_id
        and company.user_id != viewer_id
        and member is None
        and project.created_by != viewer_id
    )
    if is_customer_rep_only:
        cm = _customer_representative_cabinet_modules(project.enabled_modules)
        readonly = True
    else:
        cm = compute_cabinet_modules(
            project.enabled_modules,
            viewer_id=viewer_id,
            project_created_by=project.created_by,
            company_owner_id=company.user_id if company else None,
            member_permissions=[str(x) for x in (member.permissions or [])] if member else None,
        )
        readonly = False
    base = ProjectResponse.model_validate(project)
    return base.model_copy(update={"cabinet_modules": cm, "read_only_marketing": readonly})


async def _revoke_project_member_content_shares(
    db: AsyncSession,
    project_id: UUID,
    member_user_id: UUID,
) -> None:
    await db.execute(
        text(
            """
            DELETE FROM content_shares cs
            USING unified_content uc
            WHERE cs.content_id = uc.id
              AND uc.project_id = CAST(:pid AS uuid)
              AND cs.shared_with_user_id = :mid
            """
        ),
        {"pid": str(project_id), "mid": str(member_user_id)},
    )


def _projects_visible_to_user_filter(user_id: UUID):
    """Условие SQLAlchemy: проект виден владельцу компании (карточка), представителю заказчика
    по той же компании, создателю проекта или активному участнику команды.

    Представитель видит все неудалённые проекты компании (кабинет заказчика); ограничения
    на редактирование — отдельно (read-only маркетинг, мутации в marketing_cabinet).
    """
    owner_company_ids = select(Company.id).where(and_(Company.user_id == user_id, Company.deleted_at.is_(None)))
    representative_company_ids = select(Company.id).where(
        and_(
            Company.representative_user_id == user_id,
            Company.deleted_at.is_(None),
        )
    )
    accessible_project_ids = select(ProjectMember.project_id).where(
        and_(
            ProjectMember.user_id == user_id,
            cast(ProjectMember.status, String) == "active",
        )
    )
    return or_(
        Project.company_id.in_(owner_company_ids),
        Project.company_id.in_(representative_company_ids),
        Project.created_by == user_id,
        Project.id.in_(accessible_project_ids),
    )


# ========================================
# 🔐 HELPER FUNCTIONS FOR PERMISSIONS
# ========================================


async def get_project_member(
    db: AsyncSession, project_id: UUID, user_id: UUID, *, require_active: bool = True
) -> ProjectMember | None:
    """
    Get project member with active status check.

    Args:
        db: Database session
        project_id: Project UUID
        user_id: User UUID
        require_active: If True, only return active members

    Returns:
        ProjectMember instance or None

    Raises:
        ValueError: If project_id or user_id is invalid
    """
    # Validate UUIDs
    if not isinstance(project_id, UUID):
        msg = f"Invalid project_id type: {type(project_id)}"
        raise ValueError(msg)
    if not isinstance(user_id, UUID):
        msg = f"Invalid user_id type: {type(user_id)}"
        raise ValueError(msg)

    # Build query with explicit enum handling
    # SQLAlchemy should handle enum correctly, but ensure we're using enum objects, not strings
    query = select(ProjectMember).where(and_(ProjectMember.project_id == project_id, ProjectMember.user_id == user_id))
    if require_active:
        # FIX: cast to text — asyncpg sends enum .name ("ACTIVE"), PG expects .value ("active")
        query = query.where(cast(ProjectMember.status, String) == "active")

    result = await db.execute(query)
    return result.scalar_one_or_none()


async def _user_has_project_role(
    db: AsyncSession, project_id: UUID, user_id: UUID, required_roles: list[ProjectMemberRole]
) -> bool:
    """
    Check if user has one of the required roles without loading full ProjectMember.
    Uses cast(role, String) to avoid SQLAlchemy enum LookupError when DB has 'owner'.
    """
    required_values = [r.value for r in required_roles]
    result = await db.execute(
        select(cast(ProjectMember.role, String)).where(
            and_(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == user_id,
                cast(ProjectMember.status, String) == "active",
            )
        )
    )
    row = result.one_or_none()
    return row is not None and row[0] in required_values


async def check_project_permission(
    db: AsyncSession,
    project_id: UUID,
    user_id: UUID,
    required_roles: list[ProjectMemberRole],
    *,
    raise_on_denied: bool = True,
    load_member: bool = True,
) -> ProjectMember | None:
    """
    Check if user has required role(s) for project access.

    Args:
        db: Database session
        project_id: Project UUID
        user_id: User UUID
        required_roles: List of roles that grant access
        raise_on_denied: If True, raise HTTPException on access denied
        load_member: If False, only check role (avoids loading ProjectMember, prevents enum LookupError)

    Returns:
        ProjectMember instance if access granted and load_member=True, else truthy/falsy
    """
    if not load_member:
        has_role = await _user_has_project_role(db, project_id, user_id, required_roles)
        if not has_role:
            if raise_on_denied:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Insufficient permissions to perform operation",
                )
            return None
        return True  # type: ignore[return-value]  # Caller uses as truthy

    member = await get_project_member(db, project_id, user_id, require_active=True)

    if not member:
        logger.warning(
            "Project permission denied: user %s not found as active member of project %s",
            user_id,
            project_id,
        )
        if raise_on_denied:
            detail_msg = "Insufficient permissions to perform operation"
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=detail_msg,
            )
        return None

    # Compare enum values properly - convert to values for comparison
    member_role_value = member.role.value if hasattr(member.role, "value") else member.role
    required_role_values = [role.value if hasattr(role, "value") else role for role in required_roles]

    if member_role_value not in required_role_values:
        if raise_on_denied:
            detail_msg = "Insufficient permissions to perform operation"
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=detail_msg,
            )
        return None

    return member


async def resolve_current_project_user_uuid(user: User, db: AsyncSession) -> UUID:
    """Normalize OAuth2 identity to database user UUID for project/company ownership checks."""
    return await resolve_db_user_uuid_with_session(user, db)


# ========================================
# 📁 PROJECT CRUD
# ========================================


@router.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project: ProjectCreate,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> ProjectResponse:
    """
    Создать новый проект

    - **company_id**: UUID компании
    - **name**: Название проекта
    - **slug**: URL-friendly идентификатор
    - **enabled_modules**: Список модулей (jtbd, swot, content_ai, etc.)
    """
    try:
        user_id_uuid = await resolve_current_project_user_uuid(user, db)

        company_result = await db.execute(
            select(Company.id).where(
                and_(
                    Company.id == project.company_id,
                    Company.user_id == user_id_uuid,
                    Company.deleted_at.is_(None),
                )
            )
        )
        if company_result.scalar_one_or_none() is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Company not found or access denied",
            )

        # Check if slug already exists for this company
        result = await db.execute(
            select(Project).where(
                and_(
                    Project.company_id == project.company_id,
                    Project.slug == project.slug,
                    Project.deleted_at.is_(None),  # SQLAlchemy: use .is_(None) instead of is None
                )
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            detail_msg = "Project with this slug already exists in this company"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=detail_msg,
            )

        # Create project (goals / key_tasks живут в JSON metadata, не в колонках)
        project_payload = project.model_dump()
        goals_val = project_payload.pop("goals", None)
        key_tasks_val = project_payload.pop("key_tasks", None)
        new_project = Project(**project_payload, created_by=user_id_uuid)
        md: dict[str, object] = dict(new_project.meta_data) if isinstance(new_project.meta_data, dict) else {}
        if goals_val is not None and str(goals_val).strip():
            md["cabinet_goals"] = str(goals_val).strip()
        if key_tasks_val is not None and str(key_tasks_val).strip():
            md["cabinet_key_tasks"] = str(key_tasks_val).strip()
        np: Any = new_project
        np.meta_data = md
        db.add(new_project)
        await db.commit()
        await db.refresh(new_project)

        # Add creator as owner (raw SQL to avoid PG_ENUM sending enum NAME instead of VALUE)
        # Use CAST() instead of :: to avoid asyncpg/sqlalchemy conflict with :param
        owner_id = uuid.uuid4()
        joined_at_naive = datetime.now(UTC).replace(tzinfo=None)
        await db.execute(
            text("""
                INSERT INTO project_members (id, project_id, user_id, invited_by, role, permissions, status, joined_at, created_at, updated_at)
                VALUES (
                    CAST(:id AS uuid),
                    CAST(:project_id AS uuid),
                    CAST(:user_id AS uuid),
                    NULL,
                    CAST(:role AS project_member_role),
                    CAST(:permissions AS varchar[]),
                    CAST(:status AS member_status),
                    :joined_at,
                    :created_at,
                    :updated_at
                )
            """),
            {
                "id": str(owner_id),
                "project_id": str(new_project.id),
                "user_id": str(user_id_uuid),
                "role": "owner",
                "permissions": [],
                "status": "active",
                "joined_at": joined_at_naive,
                "created_at": joined_at_naive,
                "updated_at": joined_at_naive,
            },
        )
        await db.commit()

        try:
            await ensure_project_desktop_folder(
                db,
                user_id=user_id_uuid,
                project_id=new_project.id,
                project_name=new_project.name,
            )
            await db.commit()
        except Exception:
            logger.exception(
                "Project desktop folder ensure failed for project %s",
                new_project.id,
            )
            await db.rollback()

        logger.info(
            "Project created: %s (ID: %s) by user %s",
            new_project.name,
            new_project.id,
            user.username,
        )
        return await _project_response_with_cabinet(db, new_project, user_id_uuid)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error creating project")
        await db.rollback()
        detail_msg = f"Error creating project: {e!s}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_msg,
        ) from e


@router.get("/projects", response_model=list[ProjectResponse])
async def list_projects(
    company_id: UUID | None = Query(None, description="Filter by company"),
    project_status: str | None = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0, description="Skip records"),
    limit: int = Query(100, ge=1, le=1000, description="Limit records"),
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> list[ProjectResponse]:
    """
    Получить список проектов

    Видимость: владелец компании (карточка), представитель заказчика по компании,
    создатель проекта, активный участник команды.

    Фильтры:
    - **company_id**: ID компании
    - **status**: active, archived, completed, on_hold, cancelled
    """
    try:
        user_id_uuid = await resolve_current_project_user_uuid(user, db)

        # SQLAlchemy: use .is_(None) instead of is None
        query = select(Project).where(
            and_(
                Project.deleted_at.is_(None),
                _projects_visible_to_user_filter(user_id_uuid),
            )
        )

        if company_id:
            query = query.where(Project.company_id == company_id)

        if project_status:
            query = query.where(Project.status == project_status)

        # Order by created_at DESC
        query = query.order_by(Project.created_at.desc())
        query = query.offset(skip).limit(limit)

        result = await db.execute(query)
        projects = list(result.scalars().all())

        logger.info("Project list retrieved: %s records (user: %s)", len(projects), user.username)
        if not projects:
            return []

        company_ids = {p.company_id for p in projects}
        cr = await db.execute(select(Company).where(Company.id.in_(company_ids)))
        companies_map = {c.id: c for c in cr.scalars().all()}
        pids = [p.id for p in projects]
        mr = await db.execute(
            select(ProjectMember).where(
                and_(
                    ProjectMember.user_id == user_id_uuid,
                    ProjectMember.project_id.in_(pids),
                    cast(ProjectMember.status, String) == "active",
                )
            )
        )
        member_map = {m.project_id: m for m in mr.scalars().all()}

        enriched: list[ProjectResponse] = []
        for p in projects:
            comp = companies_map.get(p.company_id)
            mem = member_map.get(p.id)
            is_customer_rep_only = (
                comp is not None
                and comp.representative_user_id is not None
                and comp.representative_user_id == user_id_uuid
                and comp.user_id != user_id_uuid
                and mem is None
                and p.created_by != user_id_uuid
            )
            if is_customer_rep_only:
                cm_list: list[str] | None = []
            else:
                cm_list = compute_cabinet_modules(
                    p.enabled_modules,
                    viewer_id=user_id_uuid,
                    project_created_by=p.created_by,
                    company_owner_id=comp.user_id if comp else None,
                    member_permissions=[str(x) for x in (mem.permissions or [])] if mem else None,
                )
            pr = ProjectResponse.model_validate(p)
            enriched.append(pr.model_copy(update={"cabinet_modules": cm_list}))
        return enriched
    except Exception as e:
        error_msg = str(e)
        error_type = type(e).__name__

        # Handle non-critical errors (RabbitMQ channel/connection) gracefully
        is_non_critical = (
            "ChannelClosed" in error_type
            or "channel" in error_msg.lower()
            or "connection closed" in error_msg.lower()
            or "connection is closed" in error_msg.lower()
            or "connectionclosed" in error_msg.lower()
            or "connection refused" in error_msg.lower()
            or "connectionforced" in error_msg.lower()
            or "connection_reset" in error_msg.lower()
            or "amqpconnectionerror" in error_msg.lower()
            or "connection lost" in error_msg.lower()
        )

        if is_non_critical:
            logger.warning(
                "Non-critical error in list_projects (RabbitMQ/connection): %s. "
                "Project list retrieval from database should still work.",
                error_msg,
            )
            # Return empty list instead of raising error for non-critical issues
            return []

        logger.exception(
            "Failed to list projects for user %s",
            user.id,
            extra={
                "user_id": str(user.id),
                "company_id": str(company_id) if company_id else None,
                "project_status": project_status,
                "skip": skip,
                "limit": limit,
                "error_type": error_type,
            },
        )
        detail_msg = f"Error retrieving list: {e!s}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_msg,
        ) from e


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> ProjectResponse:
    """
    Получить проект по ID
    """
    try:
        user_id_uuid = await resolve_current_project_user_uuid(user, db)
        # SQLAlchemy: use .is_(None) instead of is None
        result = await db.execute(
            select(Project).where(
                and_(
                    Project.id == project_id,
                    Project.deleted_at.is_(None),
                    _projects_visible_to_user_filter(user_id_uuid),
                )
            )
        )
        project = result.scalar_one_or_none()

        if not project:
            detail_msg = "Project not found"
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail_msg)

        logger.info("Project retrieved: %s (ID: %s)", project.name, project_id)
        return await _project_response_with_cabinet(db, project, user_id_uuid)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error retrieving project")
        detail_msg = f"Error retrieving project: {e!s}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_msg,
        ) from e


@router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    updates: ProjectUpdate,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> ProjectResponse:
    """
    Обновить проект

    Только члены команды с ролью owner/admin/editor могут изменять проект
    """
    try:
        user_id_uuid = await resolve_current_project_user_uuid(user, db)
        # Get project
        # SQLAlchemy: use .is_(None) instead of is None
        result = await db.execute(select(Project).where(and_(Project.id == project_id, Project.deleted_at.is_(None))))
        project = result.scalar_one_or_none()

        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Проект не найден")

        # Check permissions (user must be owner/admin/editor)
        # user.id is already UUID, no need to convert
        await check_project_permission(
            db=db,
            project_id=project_id,
            user_id=user_id_uuid,
            required_roles=[
                ProjectMemberRole.OWNER,
                ProjectMemberRole.ADMIN,
                ProjectMemberRole.EDITOR,
            ],
            raise_on_denied=True,
            load_member=False,  # DB stores enum values ('owner'); ORM Enum defaults to names — avoid LookupError
        )

        # Update fields
        update_data = updates.model_dump(exclude_unset=True)
        if not update_data:
            # No fields to update
            await db.refresh(project)
            return await _project_response_with_cabinet(db, project, user_id_uuid)

        md: dict[str, object] = dict(project.meta_data) if isinstance(project.meta_data, dict) else {}
        meta_touched = False
        if "goals" in update_data:
            g = update_data.pop("goals")
            meta_touched = True
            if g is None or (isinstance(g, str) and not g.strip()):
                md.pop("cabinet_goals", None)
            else:
                md["cabinet_goals"] = str(g).strip()
        if "key_tasks" in update_data:
            kt = update_data.pop("key_tasks")
            meta_touched = True
            if kt is None or (isinstance(kt, str) and not kt.strip()):
                md.pop("cabinet_key_tasks", None)
            else:
                md["cabinet_key_tasks"] = str(kt).strip()
        if meta_touched:
            pj: Any = project
            pj.meta_data = md
            flag_modified(project, "meta_data")

        for field, value in update_data.items():
            # Validate that field exists on Project model
            if not hasattr(project, field):
                logger.warning(
                    "Attempted to update non-existent field '%s' on project %s",
                    field,
                    project_id,
                )
                continue
            setattr(project, field, value)

        await db.commit()
        await db.refresh(project)

        logger.info(
            "Project updated: %s (ID: %s) by user %s",
            project.name,
            project_id,
            user.username,
        )
        return await _project_response_with_cabinet(db, project, user_id_uuid)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error updating project")
        await db.rollback()
        detail_msg = f"Error updating project: {e!s}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_msg,
        ) from e


@router.delete("/projects/{project_id}", status_code=status.HTTP_200_OK)
async def delete_project(
    project_id: UUID,
    delete_desktop_project_folder_contents: bool = Query(
        True,
        description=(
            "Deprecated: vault cleanup always runs on project delete. "
            "Soft-deletes all unified_content rows with this project_id and removes eliteew-proj-* desktop folders."
        ),
    ),
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, str]:
    """
    Удалить проект (soft delete)

    Только владелец (owner) может удалять проект.
    Вместе с проектом всегда soft-delete всех файлов с project_id и удаляются папки eliteew-proj-* на столе.
    """
    try:
        user_id_uuid = await resolve_current_project_user_uuid(user, db)
        # Get project
        # SQLAlchemy: use .is_(None) instead of is None
        result = await db.execute(select(Project).where(and_(Project.id == project_id, Project.deleted_at.is_(None))))
        project = result.scalar_one_or_none()

        if not project:
            detail_msg = "Project not found"
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail_msg)

        # Check permissions: project creator (created_by) OR owner in project_members
        # Check is_creator first to avoid loading ProjectMember when DB has role="owner"
        # (SQLAlchemy enum expects "OWNER" name, causes LookupError on load)
        is_creator = project.created_by is not None and project.created_by == user_id_uuid

        if not is_creator:
            member = await check_project_permission(
                db=db,
                project_id=project_id,
                user_id=user_id_uuid,
                required_roles=[ProjectMemberRole.OWNER],
                raise_on_denied=False,
                load_member=False,  # avoid loading ProjectMember (enum LookupError on role='owner')
            )
        else:
            member = True  # creator is allowed

        if not member and not is_creator:
            # Log detailed info for debugging
            logger.warning(
                "Delete project denied: user %s (UUID: %s) is not owner of project %s",
                user.id,
                user_id_uuid,
                project_id,
            )
            # Check if user is a member at all
            any_member = await get_project_member(db, project_id, user_id_uuid, require_active=False)
            if any_member:
                role_value = any_member.role.value if hasattr(any_member.role, "value") else any_member.role
                logger.warning(
                    "User is a member with role: %s (value: %s)",
                    any_member.role,
                    role_value,
                )
            else:
                logger.warning("User is not a member of this project at all")
            detail_msg = "Only project owner can delete it"
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=detail_msg,
            )

        # Soft delete via raw SQL to avoid ORM datetime timezone issues (offset-naive/aware)
        now_naive = datetime.now(UTC).replace(tzinfo=None)
        await db.execute(
            text("""
                UPDATE projects
                SET deleted_at = :deleted_at, updated_at = :updated_at
                WHERE id = :project_id
            """),
            {"deleted_at": now_naive, "updated_at": now_naive, "project_id": project_id},
        )

        folder_item_id = project_desktop_folder_item_id(project_id)

        if not delete_desktop_project_folder_contents:
            logger.info(
                "delete_project: ignoring delete_desktop_project_folder_contents=false for %s (vault cleanup is mandatory)",
                project_id,
            )

        await db.execute(
            text("""
                UPDATE unified_content
                SET deleted_at = :deleted_at,
                    updated_at = :updated_at,
                    updated_by = :uid,
                    project_id = NULL,
                    folder_item_id = NULL
                WHERE project_id = :project_id
                  AND deleted_at IS NULL
            """),
            {
                "deleted_at": now_naive,
                "updated_at": now_naive,
                "uid": str(user_id_uuid),
                "project_id": project_id,
            },
        )
        await db.execute(
            text("""
                UPDATE unified_content
                SET project_id = NULL,
                    folder_item_id = NULL,
                    updated_at = :updated_at
                WHERE project_id = :project_id
                  AND deleted_at IS NOT NULL
            """),
            {
                "updated_at": now_naive,
                "project_id": project_id,
            },
        )
        await db.execute(
            text("""
                UPDATE unified_content
                SET deleted_at = COALESCE(deleted_at, :deleted_at),
                    updated_at = :updated_at,
                    updated_by = :uid,
                    project_id = NULL,
                    folder_item_id = NULL
                WHERE folder_item_id = :fid
                  AND deleted_at IS NULL
                  AND project_id IS NULL
            """),
            {
                "deleted_at": now_naive,
                "updated_at": now_naive,
                "uid": str(user_id_uuid),
                "fid": folder_item_id,
            },
        )
        await db.execute(
            text("""
                UPDATE unified_content
                SET folder_item_id = NULL,
                    updated_at = :updated_at
                WHERE folder_item_id = :fid
                  AND deleted_at IS NOT NULL
                  AND project_id IS NULL
            """),
            {"updated_at": now_naive, "fid": folder_item_id},
        )
        await db.execute(
            text("DELETE FROM desktop_items WHERE item_id = :fid"),
            {"fid": folder_item_id},
        )

        # Commit with error handling
        try:
            await db.commit()
        except Exception as commit_error:
            error_str = str(commit_error).lower()
            if "pendingrollbackerror" in error_str or "pending rollback" in error_str:
                logger.warning("PendingRollbackError during project delete, rolling back first")
                try:
                    await db.rollback()
                    await db.commit()
                except Exception as retry_error:
                    logger.exception("Failed to commit after rollback")
                    await db.rollback()
                    detail_msg = f"Error deleting project: {retry_error!s}"
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=detail_msg,
                    ) from retry_error
            elif "connection is closed" in error_str or "connection closed" in error_str:
                logger.exception("Database connection closed during project delete")
                await db.rollback()
                detail_msg = "Database connection error"
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=detail_msg,
                ) from commit_error
            else:
                await db.rollback()
                raise

        logger.info(
            "Project deleted: %s (ID: %s) by user %s",
            project.name,
            project_id,
            user.username,
        )
        return {"message": "Project successfully deleted", "project_id": str(project_id)}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error deleting project")
        with contextlib.suppress(Exception):
            await db.rollback()
        detail_msg = f"Error deleting project: {e!s}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_msg,
        ) from e


# ========================================
# 👥 PROJECT TEAM MANAGEMENT
# ========================================


_PROJECT_MEMBERS_LIST_MAX = 200


@router.get(
    "/projects/{project_id}/members",
    response_model=ProjectMembersListResponse,
)
async def list_project_members(
    project_id: UUID,
    limit: int | None = Query(None, ge=1, le=_PROJECT_MEMBERS_LIST_MAX),
    offset: int = Query(0, ge=0),
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> ProjectMembersListResponse:
    """
    Получить список членов команды проекта (items + total).
    Без ``limit`` отдаётся не более 200 строк; полный счётчик — в ``total``.
    """
    try:
        user_id_uuid = await resolve_current_project_user_uuid(user, db)
        await check_project_permission(
            db=db,
            project_id=project_id,
            user_id=user_id_uuid,
            required_roles=[
                ProjectMemberRole.OWNER,
                ProjectMemberRole.ADMIN,
                ProjectMemberRole.EDITOR,
                ProjectMemberRole.MEMBER,
                ProjectMemberRole.VIEWER,
            ],
            raise_on_denied=True,
        )
        member_filter = ProjectMember.project_id == project_id
        count_result = await db.execute(select(func.count()).select_from(ProjectMember).where(member_filter))
        total = int(count_result.scalar_one() or 0)
        effective_limit = _PROJECT_MEMBERS_LIST_MAX if limit is None else limit
        result = await db.execute(
            select(ProjectMember)
            .where(member_filter)
            .order_by(ProjectMember.created_at.asc())
            .offset(offset)
            .limit(effective_limit)
        )
        members = result.scalars().all()

        logger.info(
            "Project members list retrieved: %s/%s records (project: %s, limit=%s, offset=%s)",
            len(members),
            total,
            project_id,
            effective_limit,
            offset,
        )
        return ProjectMembersListResponse(
            items=list(members),  # type: ignore[arg-type]
            total=total,
        )
    except Exception as e:
        logger.exception("Error retrieving project members")
        detail_msg = f"Error retrieving list: {e!s}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_msg,
        ) from e


@router.post(
    "/projects/{project_id}/members",
    response_model=ProjectMemberResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_project_member(
    project_id: UUID,
    member: ProjectMemberCreate,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> ProjectMemberResponse:
    """
    Добавить члена команды в проект

    Только руководитель проекта (created_by); участник — из взаимных друзей.
    Роль owner — только через POST /projects/{id}/transfer-lead.
    """
    try:
        user_id_uuid = await resolve_current_project_user_uuid(user, db)
        await _require_project_lead_for_team(db, project_id, user_id_uuid)
        await _assert_mutual_friends_sa(db, user_id_uuid, member.user_id)

        role_raw = (member.role or "member").strip().lower()
        if role_raw == ProjectMemberRole.OWNER.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Роль руководителя задаётся через POST /projects/{id}/transfer-lead",
            )

        # Check if user is already a member
        result = await db.execute(
            select(ProjectMember).where(
                and_(ProjectMember.project_id == project_id, ProjectMember.user_id == member.user_id)
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            detail_msg = "User is already a team member"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=detail_msg,
            )

        # Add member (role/status as lowercase strings for PostgreSQL enums)
        member_data = member.model_dump()
        member_data["role"] = role_raw
        member_data["permissions"] = validate_project_member_permissions_list(
            member_data.get("permissions"),
        )
        new_member = ProjectMember(
            project_id=project_id,
            invited_by=user_id_uuid,
            status="active",  # lowercase for PostgreSQL member_status enum
            joined_at=datetime.now(UTC).replace(tzinfo=None),  # naive UTC for TIMESTAMP WITHOUT TIME ZONE
            **member_data,
        )
        db.add(new_member)
        await db.commit()
        await db.refresh(new_member)

        logger.info("Project member added: %s to project %s", member.user_id, project_id)
        return new_member
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error adding project member")
        await db.rollback()
        detail_msg = f"Error adding project member: {e!s}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_msg,
        ) from e


@router.put("/projects/{project_id}/members/{member_id}", response_model=ProjectMemberResponse)
async def update_project_member(
    project_id: UUID,
    member_id: UUID,
    updates: ProjectMemberUpdate,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> ProjectMemberResponse:
    """
    Обновить роль/права члена команды

    Только руководитель проекта (created_by). Роль owner — через transfer-lead.

    **permissions**: ``can_upload_project_vault`` (файлы/vault проекта);
    ``mc_module:<ключ>`` — разделы маркетингового кабинета (ключи как у ``enabled_modules``).
    Без префиксов ``mc_module:*`` участник видит все включённые в проекте модули (прежняя семантика).
    """
    try:
        user_id_uuid = await resolve_current_project_user_uuid(user, db)
        project_row = await _require_project_lead_for_team(db, project_id, user_id_uuid)

        result = await db.execute(select(ProjectMember).where(ProjectMember.id == member_id))
        member = result.scalar_one_or_none()

        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Член команды не найден")
        if member.project_id != project_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Член команды не найден")

        update_data = updates.model_dump(exclude_unset=True)
        if project_row.created_by is not None and member.user_id == project_row.created_by and "role" in update_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Нельзя сменить роль текущего руководителя без передачи руководства (transfer-lead)",
            )
        new_role = update_data.get("role")
        if new_role is not None:
            role_lc = str(new_role).strip().lower()
            if role_lc == ProjectMemberRole.OWNER.value:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Назначить руководителя можно только через POST /projects/{id}/transfer-lead",
                )
            update_data["role"] = role_lc

        if "permissions" in update_data:
            update_data["permissions"] = validate_project_member_permissions_list(
                update_data["permissions"],
            )

        for field, value in update_data.items():
            setattr(member, field, value)

        await db.commit()
        await db.refresh(member)

        logger.info("Project member updated: %s in project %s", member_id, project_id)
        return member
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error updating project member")
        await db.rollback()
        detail_msg = f"Error updating: {e!s}"
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail_msg) from e


@router.delete("/projects/{project_id}/members/{member_id}", status_code=status.HTTP_200_OK)
async def remove_project_member(
    project_id: UUID,
    member_id: UUID,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> dict[str, str]:
    """
    Удалить члена команды из проекта

    Только руководитель проекта (created_by). Руководителя удалить нельзя — сначала transfer-lead.
    """
    try:
        user_id_uuid = await resolve_current_project_user_uuid(user, db)
        project_row = await _require_project_lead_for_team(db, project_id, user_id_uuid)

        result = await db.execute(select(ProjectMember).where(ProjectMember.id == member_id))
        member = result.scalar_one_or_none()

        if not member:
            detail_msg = "Project member not found"
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail_msg)
        if member.project_id != project_id:
            detail_msg = "Project member not found"
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail_msg)

        if project_row.created_by is not None and member.user_id == project_row.created_by:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Нельзя удалить руководителя проекта; сначала передайте руководство (transfer-lead)",
            )

        await _revoke_project_member_content_shares(db, project_id, member.user_id)
        await db.delete(member)
        await db.commit()

        logger.info("Project member deleted: %s from project %s", member_id, project_id)
        return {"message": "Project member deleted", "member_id": str(member_id)}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error deleting project member")
        await db.rollback()
        detail_msg = f"Error deleting: {e!s}"
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=detail_msg) from e


@router.post("/projects/{project_id}/transfer-lead", response_model=ProjectResponse)
async def transfer_project_lead(
    project_id: UUID,
    body: TransferLeadRequest,
    user: User = Depends(require_oauth2_user),
    db: AsyncSession = Depends(get_postgres_session),
) -> ProjectResponse:
    """Передать роль руководителя проекта (created_by) активному участнику."""
    try:
        user_id_uuid = await resolve_current_project_user_uuid(user, db)
        project_row = await _require_project_lead_for_team(db, project_id, user_id_uuid)
        if body.new_lead_user_id == user_id_uuid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Пользователь уже является руководителем проекта",
            )

        nres = await db.execute(
            select(ProjectMember).where(
                and_(
                    ProjectMember.project_id == project_id,
                    ProjectMember.user_id == body.new_lead_user_id,
                )
            )
        )
        new_m = nres.scalar_one_or_none()
        # Нельзя сравнивать cast(...) с строкой в Python: получится SQL-выражение, truthy → ложное «не active».
        if new_m is None or new_m.status != MemberStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Новый руководитель должен быть активным участником проекта",
            )

        ores = await db.execute(
            select(ProjectMember).where(
                and_(
                    ProjectMember.project_id == project_id,
                    ProjectMember.user_id == user_id_uuid,
                )
            )
        )
        old_m = ores.scalar_one_or_none()

        pr: Any = project_row
        pr.created_by = body.new_lead_user_id
        if old_m is not None:
            om: Any = old_m
            om.role = ProjectMemberRole.ADMIN
        nm: Any = new_m
        nm.role = ProjectMemberRole.OWNER

        await db.commit()
        await db.refresh(project_row)

        logger.info(
            "Project lead transferred: project=%s new_lead=%s by=%s",
            project_id,
            body.new_lead_user_id,
            user.username,
        )
        return await _project_response_with_cabinet(db, project_row, user_id_uuid)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error transferring project lead")
        await db.rollback()
        detail_msg = f"Error transferring lead: {e!s}"
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail_msg,
        ) from e
