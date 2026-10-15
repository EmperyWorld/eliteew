# ---
# EliteEW · Empery World
# https://eliteew.ru
# Author: po&T <keysray70@gmail.com>
# ---
# Purpose:
# Professional Worlds learning and artifacts HTTP routes.
# Invariants:
# - Routes mount on the main Professional Worlds router without a path prefix change.
# Related:
# - api/routers/professional_worlds_deps.py
# - api/routers/professional_worlds.py
# ---

from __future__ import annotations

from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status  # type: ignore[import-untyped]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.core.auth import User
from api.core.database_manager import get_postgres_session
from api.core.oauth2_auth import require_oauth2_user
from api.routers.professional_worlds_deps import _current_user_id, _service
from api.schemas.professional_worlds import (
    LessonCompleteBody,
    ProfessionalArtifactOut,
    ProfessionalLearningCourseOut,
)
from api.services.professional_worlds.service import REALTOR_VERTICAL_SLUG

learning_router = APIRouter()


@learning_router.get("/learning/courses", response_model=list[ProfessionalLearningCourseOut])
async def list_learning_courses(
    vertical_slug: str = Query(default=REALTOR_VERTICAL_SLUG, max_length=80),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """List learning courses (lessons + completion) for the active profession vertical."""
    slug = vertical_slug.strip() or REALTOR_VERTICAL_SLUG
    return await _service(db).list_courses(_current_user_id(user), slug)


@learning_router.get("/learning/courses/{course_id}", response_model=ProfessionalLearningCourseOut)
async def get_learning_course(
    course_id: UUID,
    vertical_slug: str = Query(default=REALTOR_VERTICAL_SLUG, max_length=80),
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> dict[str, Any]:
    """Return one course with lessons."""
    slug = vertical_slug.strip() or REALTOR_VERTICAL_SLUG
    courses = await _service(db).list_courses(_current_user_id(user), slug)
    for course in courses:
        if course["id"] == course_id:
            return course
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")


@learning_router.post("/learning/lessons/{lesson_id}/complete", status_code=status.HTTP_204_NO_CONTENT)
async def complete_lesson(
    lesson_id: UUID,
    payload: LessonCompleteBody,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> None:
    """Mark lesson complete."""
    await _service(db).complete_lesson(_current_user_id(user), lesson_id, payload)


@learning_router.get("/artifacts", response_model=list[ProfessionalArtifactOut])
async def list_artifacts(
    vertical_slug: str | None = Query(default=None, description="Filter by active profession vertical"),
    property_id: UUID | None = None,
    module_key: str | None = None,
    artifact_kind: str | None = None,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> list[dict[str, Any]]:
    """List generated artifacts for the given profession vertical."""
    slug = (vertical_slug or "").strip() or REALTOR_VERTICAL_SLUG
    user_id = _current_user_id(user)
    if property_id or module_key or artifact_kind:
        return await _service(db).list_artifacts_filtered(
            user_id,
            vertical_slug=slug,
            source_id=property_id,
            module_key=module_key,
            artifact_kind=artifact_kind,
        )
    return await _service(db).list_artifacts(user_id, vertical_slug=slug)


@learning_router.delete("/artifacts/{artifact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_artifact(
    artifact_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),  # noqa: B008
    user: User = Depends(require_oauth2_user),  # noqa: B008
) -> None:
    """Delete generated artifact for current user."""
    deleted = await _service(db).delete_artifact(_current_user_id(user), artifact_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artifact not found")
