#!/usr/bin/env python3
# ------------------------------------------------------------------------------
#  EliteEW · Empery World
#  https://eliteew.ru
#  Author: po&T <keysray70@gmail.com>
# ------------------------------------------------------------------------------
# Purpose:
#   Репозиторий транскриптов: CRUD, фильтры, статистика (async SQLAlchemy).
# Invariants:
#   - Завершение записи — completed_at через utc_now_naive при смене статуса.
# Related:
#   - api/models/transcription.py, audio_transcription router
# ------------------------------------------------------------------------------
"""
Transcription Repository

Data access layer for transcription operations with async SQLAlchemy.

Provides CRUD operations, filtering, statistics, and batch operations
for audio transcription records.

Features:
- Async/await PostgreSQL operations
- Type-safe query building
- Efficient pagination
- JSONB querying for segments/metadata
- User-scoped operations
- Statistics aggregation
- Batch operations

Created: 2025-10-23
"""

from datetime import datetime
from uuid import UUID

from sqlalchemy import and_, desc, func, or_, select  # type: ignore[import-not-found]
from sqlalchemy.ext.asyncio import AsyncSession  # type: ignore[import-not-found]

from api.models.transcription import Transcription
from api.schemas.transcription import TranscriptionCreate, TranscriptionStats, TranscriptionUpdate
from api.utils.datetime_helpers import utc_now_naive


class TranscriptionRepository:
    """
    Repository for Transcription model operations.

    Handles all database interactions for audio transcriptions with
    optimized queries and user-scoped access.
    """

    # ========================================================================
    # CREATE OPERATIONS
    # ========================================================================

    @staticmethod
    async def create(db: AsyncSession, transcription_data: TranscriptionCreate) -> Transcription:
        """
        Create a new transcription record.

        Args:
            db: Database session
            transcription_data: Transcription creation data

        Returns:
            Created transcription instance

        Example:
            ```python
            transcription = await TranscriptionRepository.create(
                db,
                TranscriptionCreate(
                    user_id=user_id,
                    filename="meeting.mp3",
                    file_size_bytes=5242880,
                    audio_format="mp3",
                    whisper_model="large-v3",
                    transcription_text="Hello world...",
                    confidence_score=0.95
                )
            )
            ```
        """
        transcription = Transcription(**transcription_data.model_dump())

        # Calculate word/character counts
        transcription.calculate_metrics()

        # Set completion timestamp if status is completed
        # transcription.status is a string value from the model instance, not a Column
        if str(transcription.status) == "completed":  # type: ignore[operator]
            transcription.completed_at = utc_now_naive()  # type: ignore[assignment]

        db.add(transcription)
        await db.flush()
        await db.refresh(transcription)

        return transcription

    # ========================================================================
    # READ OPERATIONS
    # ========================================================================

    @staticmethod
    async def get_by_id(db: AsyncSession, transcription_id: UUID, user_id: UUID | None = None) -> Transcription | None:
        """
        Get transcription by ID.

        Args:
            db: Database session
            transcription_id: Transcription UUID
            user_id: Optional user ID for access control

        Returns:
            Transcription instance or None if not found
        """
        query = select(Transcription).where(Transcription.id == transcription_id)

        if user_id:
            query = query.where(Transcription.user_id == user_id)

        result = await db.execute(query)
        return result.scalar_one_or_none()

    @staticmethod
    async def get_by_user(
        db: AsyncSession,
        user_id: UUID,
        *,
        skip: int = 0,
        limit: int = 20,
        status: str | None = None,
        language: str | None = None,
        whisper_model: str | None = None,
        is_favorite: bool | None = None,
        search: str | None = None,
        order_by: str = "created_at",
        order_desc: bool = True,
    ) -> tuple[list[Transcription], int]:
        """
        Get transcriptions for a user with filtering and pagination.

        Args:
            db: Database session
            user_id: User UUID
            skip: Number of records to skip
            limit: Maximum number of records to return
            status: Filter by status
            language: Filter by language
            whisper_model: Filter by Whisper model
            is_favorite: Filter by favorite status
            search: Search in filename and transcription text
            order_by: Field to order by
            order_desc: Sort descending if True

        Returns:
            Tuple of (transcriptions list, total count)

        Example:
            ```python
            transcriptions, total = await TranscriptionRepository.get_by_user(
                db,
                user_id=user_id,
                status="completed",
                language="en",
                is_favorite=True,
                limit=20
            )
            ```
        """
        # Build base query
        query = select(Transcription).where(Transcription.user_id == user_id)

        # Apply filters
        if status:
            query = query.where(Transcription.status == status)

        if language:
            query = query.where(Transcription.language == language)

        if whisper_model:
            query = query.where(Transcription.whisper_model == whisper_model)

        if is_favorite is not None:
            query = query.where(Transcription.is_favorite == is_favorite)

        if search:
            search_pattern = f"%{search}%"
            query = query.where(
                or_(
                    Transcription.filename.ilike(search_pattern), Transcription.transcription_text.ilike(search_pattern)
                )
            )

        # Count total before pagination
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar() or 0

        # Apply ordering
        order_column = getattr(Transcription, order_by, Transcription.created_at)
        query = query.order_by(desc(order_column)) if order_desc else query.order_by(order_column)

        # Apply pagination
        query = query.offset(skip).limit(limit)

        # Execute query
        result = await db.execute(query)
        transcriptions = result.scalars().all()

        return list(transcriptions), total

    @staticmethod
    async def get_recent(db: AsyncSession, user_id: UUID, limit: int = 10) -> list[Transcription]:
        """
        Get most recent transcriptions for a user.

        Args:
            db: Database session
            user_id: User UUID
            limit: Maximum number of records

        Returns:
            List of recent transcriptions
        """
        query = (
            select(Transcription)
            .where(Transcription.user_id == user_id)
            .order_by(desc(Transcription.created_at))
            .limit(limit)
        )

        result = await db.execute(query)
        return list(result.scalars().all())

    @staticmethod
    async def get_favorites(
        db: AsyncSession, user_id: UUID, skip: int = 0, limit: int = 20
    ) -> tuple[list[Transcription], int]:
        """
        Get favorite transcriptions for a user.

        Args:
            db: Database session
            user_id: User UUID
            skip: Number of records to skip
            limit: Maximum number of records

        Returns:
            Tuple of (favorites list, total count)
        """
        return await TranscriptionRepository.get_by_user(db, user_id=user_id, skip=skip, limit=limit, is_favorite=True)

    # ========================================================================
    # UPDATE OPERATIONS
    # ========================================================================

    @staticmethod
    async def update(
        db: AsyncSession, transcription_id: UUID, user_id: UUID, update_data: TranscriptionUpdate
    ) -> Transcription | None:
        """
        Update transcription fields.

        Args:
            db: Database session
            transcription_id: Transcription UUID
            user_id: User UUID for access control
            update_data: Fields to update

        Returns:
            Updated transcription or None if not found
        """
        transcription = await TranscriptionRepository.get_by_id(db, transcription_id, user_id)

        if not transcription:
            return None

        # Update fields
        update_dict = update_data.model_dump(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(transcription, field, value)

        await db.flush()
        await db.refresh(transcription)

        return transcription

    @staticmethod
    async def toggle_favorite(db: AsyncSession, transcription_id: UUID, user_id: UUID) -> Transcription | None:
        """
        Toggle favorite status.

        Args:
            db: Database session
            transcription_id: Transcription UUID
            user_id: User UUID

        Returns:
            Updated transcription or None if not found
        """
        transcription = await TranscriptionRepository.get_by_id(db, transcription_id, user_id)

        if not transcription:
            return None

        transcription.is_favorite = not transcription.is_favorite  # type: ignore[assignment]
        await db.flush()
        await db.refresh(transcription)

        return transcription

    # ========================================================================
    # DELETE OPERATIONS
    # ========================================================================

    @staticmethod
    async def delete(db: AsyncSession, transcription_id: UUID, user_id: UUID) -> bool:
        """
        Delete a transcription.

        Args:
            db: Database session
            transcription_id: Transcription UUID
            user_id: User UUID for access control

        Returns:
            True if deleted, False if not found
        """
        transcription = await TranscriptionRepository.get_by_id(db, transcription_id, user_id)

        if not transcription:
            return False

        await db.delete(transcription)
        await db.flush()

        return True

    @staticmethod
    async def delete_bulk(db: AsyncSession, transcription_ids: list[UUID], user_id: UUID) -> int:
        """
        Delete multiple transcriptions.

        Args:
            db: Database session
            transcription_ids: List of transcription UUIDs
            user_id: User UUID for access control

        Returns:
            Number of deleted records
        """
        query = select(Transcription).where(
            and_(Transcription.id.in_(transcription_ids), Transcription.user_id == user_id)
        )

        result = await db.execute(query)
        transcriptions = result.scalars().all()

        for transcription in transcriptions:
            await db.delete(transcription)

        await db.flush()

        return len(transcriptions)

    # ========================================================================
    # STATISTICS
    # ========================================================================

    @staticmethod
    async def get_statistics(
        db: AsyncSession, user_id: UUID, *, from_date: datetime | None = None, to_date: datetime | None = None
    ) -> TranscriptionStats:
        """
        Get transcription statistics for a user.

        Args:
            db: Database session
            user_id: User UUID
            from_date: Start date for filtering
            to_date: End date for filtering

        Returns:
            TranscriptionStats with aggregated metrics

        Example:
            ```python
            stats = await TranscriptionRepository.get_statistics(
                db,
                user_id=user_id,
                from_date=utc_now_naive()  # optionally bound with timedelta from datetime
            )
            print(f"Total: {stats.total_transcriptions}")
            print(f"Hours: {stats.total_duration_hours}")
            ```
        """
        # Build base query
        query = select(Transcription).where(Transcription.user_id == user_id)

        if from_date:
            query = query.where(Transcription.created_at >= from_date)

        if to_date:
            query = query.where(Transcription.created_at <= to_date)

        # Execute query
        result = await db.execute(query)
        transcriptions = result.scalars().all()

        # Calculate statistics
        total_transcriptions = len(transcriptions)
        total_duration_sec = sum(t.duration_seconds for t in transcriptions if t.duration_seconds is not None)
        total_words = sum(t.word_count for t in transcriptions if t.word_count is not None)
        total_processing_ms = sum(t.processing_time_ms for t in transcriptions if t.processing_time_ms is not None)

        # Count by language
        by_language: dict[str, int] = {}
        for t in transcriptions:
            lang = str(t.language) if t.language is not None else "unknown"
            by_language[lang] = by_language.get(lang, 0) + 1

        # Count by model
        by_model: dict[str, int] = {}
        for t in transcriptions:
            model = str(t.whisper_model)
            by_model[model] = by_model.get(model, 0) + 1

        # Count by status
        by_status: dict[str, int] = {}
        for t in transcriptions:
            status = str(t.status)
            by_status[status] = by_status.get(status, 0) + 1

        # Calculate average confidence
        confidences = [t.confidence_score for t in transcriptions if t.confidence_score is not None]
        average_confidence = sum(confidences) / len(confidences) if confidences else 0.0

        # Count favorites
        favorite_count = sum(1 for t in transcriptions if t.is_favorite is True)

        return TranscriptionStats(
            total_transcriptions=total_transcriptions,
            total_duration_hours=float(total_duration_sec / 3600.0),  # type: ignore[arg-type]
            total_words=int(total_words),  # type: ignore[arg-type]
            total_processing_time_hours=float(total_processing_ms / (1000 * 3600)),  # type: ignore[arg-type]
            by_language=by_language,
            by_model=by_model,
            by_status=by_status,
            average_confidence=round(average_confidence, 2),  # type: ignore[call-overload]
            favorite_count=favorite_count,
        )


# ============================================================================
# EXAMPLE USAGE
# ============================================================================

"""
Example usage in FastAPI route:

```python
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from api.core.database_manager import get_postgres_session
from api.repositories.transcription_repository import TranscriptionRepository
from api.schemas.transcription import TranscriptionResponse, TranscriptionListResponse

router = APIRouter()

@router.get("/transcriptions")
async def list_transcriptions(
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
    language: str | None = None,
    db: AsyncSession = Depends(get_postgres_session),
    user: User = Depends(require_oauth2_user)
):
    skip = (page - 1) * page_size

    transcriptions, total = await TranscriptionRepository.get_by_user(
        db,
        user_id=user.id,
        skip=skip,
        limit=page_size,
        status=status,
        language=language
    )

    return TranscriptionListResponse(
        transcriptions=[t.to_summary() for t in transcriptions],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    )

@router.get("/transcriptions/{transcription_id}")
async def get_transcription(
    transcription_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    user: User = Depends(require_oauth2_user)
):
    transcription = await TranscriptionRepository.get_by_id(
        db, transcription_id, user.id
    )

    if not transcription:
        raise HTTPException(404, "Transcription not found")

    return TranscriptionResponse.model_validate(transcription)

@router.post("/transcriptions/{transcription_id}/favorite")
async def toggle_favorite(
    transcription_id: UUID,
    db: AsyncSession = Depends(get_postgres_session),
    user: User = Depends(require_oauth2_user)
):
    transcription = await TranscriptionRepository.toggle_favorite(
        db, transcription_id, user.id
    )

    if not transcription:
        raise HTTPException(404, "Transcription not found")

    return {"is_favorite": transcription.is_favorite}

@router.get("/transcriptions/stats")
async def get_stats(
    db: AsyncSession = Depends(get_postgres_session),
    user: User = Depends(require_oauth2_user)
):
    stats = await TranscriptionRepository.get_statistics(db, user.id)
    return stats
```
"""
