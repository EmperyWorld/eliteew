# ---
# EliteEW · Empery World
# https://empery.world
# Author: po&T && TZBrand
# ---
# Purpose:
# User-scoped SQL helpers for Professional Worlds learning courses and progress.
# Invariants:
# - Course listing is vertical-scoped; progress rows are user-scoped.
# Related:
# - api/services/professional_worlds/service.py
# ---

from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy import text  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.schemas.professional_worlds import LessonCompleteBody
from api.services.professional_worlds.snapshot_helpers import REALTOR_VERTICAL_SLUG


async def list_courses(
    db: AsyncSession, user_id: UUID, vertical_slug: str = REALTOR_VERTICAL_SLUG
) -> list[dict[str, Any]]:
    """List courses with lessons and completion flags."""
    result = await db.execute(
        text(
            """
            SELECT c.id AS course_id, c.course_key, c.vertical_slug, c.title AS course_title,
                   c.description, c.level, c.sort_order AS course_sort_order,
                   l.id AS lesson_id, l.lesson_key, l.title AS lesson_title, l.summary,
                   l.content_md, l.exercise, l.sort_order AS lesson_sort_order,
                   (p.id IS NOT NULL) AS completed
            FROM professional_learning_courses c
            LEFT JOIN professional_learning_lessons l ON l.course_id = c.id
            LEFT JOIN professional_learning_progress p ON p.lesson_id = l.id AND p.user_id = :user_id
            WHERE c.vertical_slug = :vertical_slug AND c.is_active = true
            ORDER BY c.sort_order, l.sort_order
            """
        ),
        {"user_id": user_id, "vertical_slug": vertical_slug},
    )
    courses: dict[UUID, dict[str, Any]] = {}
    for row in result.mappings().all():
        course_id = row["course_id"]
        course = courses.setdefault(
            course_id,
            {
                "id": course_id,
                "course_key": row["course_key"],
                "vertical_slug": row["vertical_slug"],
                "title": row["course_title"],
                "description": row["description"],
                "level": row["level"],
                "sort_order": row["course_sort_order"],
                "lessons": [],
            },
        )
        if row["lesson_id"] is not None:
            course["lessons"].append(
                {
                    "id": row["lesson_id"],
                    "lesson_key": row["lesson_key"],
                    "title": row["lesson_title"],
                    "summary": row["summary"],
                    "content_md": row["content_md"],
                    "exercise": row["exercise"] or {},
                    "sort_order": row["lesson_sort_order"],
                    "completed": bool(row["completed"]),
                }
            )
    return list(courses.values())


async def complete_lesson(db: AsyncSession, user_id: UUID, lesson_id: UUID, payload: LessonCompleteBody) -> bool:
    """Mark a lesson as completed for the current user."""
    result = await db.execute(
        text(
            """
            INSERT INTO professional_learning_progress (user_id, lesson_id, score, notes)
            VALUES (:user_id, :lesson_id, :score, :notes)
            ON CONFLICT (user_id, lesson_id)
            DO UPDATE SET score = EXCLUDED.score, notes = EXCLUDED.notes, completed_at = now()
            """
        ),
        {"user_id": user_id, "lesson_id": lesson_id, "score": payload.score, "notes": payload.notes},
    )
    await db.commit()
    return bool(getattr(result, "rowcount", 0))
